"""Pinecone-backed RAG service.

Vectors live in a single Pinecone serverless index, with one **namespace
per document** (namespace == ``doc_id``) so retrieval is isolated by
construction. Each vector carries ``{"chunk_idx": int}`` as metadata so a
query result can map back to the source chunk text without round-tripping
the body through the vector store.

Per-document chunk text + metadata still live on disk under
``STORAGE_DIR/rag/{doc_id}/``:
  - chunks.json : narration + rag chunk arrays + parallel page-number arrays
  - meta.json   : title, chunk counts, total pages, created_at

On hosts without a persistent disk (Render free, Fly free, etc.) the disk
gets wiped on every redeploy. To keep documents queryable across cold
starts, we mirror ``chunks.json`` + ``meta.json`` to the ``rag_indices``
Postgres table (see ``app/db/migrations/versions/0003_rag_indices.py``).
On read, if the on-disk artifacts are missing we hydrate them back from
Postgres before proceeding. Pinecone vectors are durable independently of
disk and never need re-hydration.

The legacy FAISS index file (``index.faiss``) and the ``index_bytes`` blob
in Postgres are no longer used. The Postgres column is kept (NOT NULL) and
written with a single empty byte for backward compatibility; it can be
dropped in a future migration.

Embeddings come from the HuggingFace Inference API (see :meth:`_embed`).
The dimension is fixed at 384 to match ``sentence-transformers/all-MiniLM-L6-v2``;
if you change the embedding model, you must also recreate the Pinecone
index with the new dimension and re-upload every document.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
import numpy as np
from pinecone import Pinecone, ServerlessSpec
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.core.settings import get_settings
from app.rag.chunker import (
    narration_chunks,
    narration_chunks_with_pages,
    rag_chunks,
    rag_chunks_with_pages,
)
from app.utils.security_input import safe_join, validate_doc_id

logger = logging.getLogger(__name__)

# Embedding geometry — kept at 384 to match all-MiniLM-L6-v2. If this
# changes, the Pinecone index must be recreated with the matching dim.
EMBED_DIM = 384

# HF Inference API endpoint for sentence-transformer feature extraction.
# The /pipeline/feature-extraction/ route returns sentence-level embeddings
# directly (not token-level), so we don't need to mean-pool.
_HF_BASE_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction"

# Max texts per HF request. Bounds payload size + retry cost.
_HF_BATCH_SIZE = 64

# How long a single HF embed call may take (cold model load can be ~20s
# when wait_for_model is true).
_HF_TIMEOUT_S = 60.0

# Max vectors per Pinecone upsert call. Pinecone allows up to 100 per
# request; we stay a hair below to leave headroom on metadata size.
_PC_UPSERT_BATCH = 96

# Sentinel byte written to the legacy ``index_bytes`` column so the NOT NULL
# constraint stays satisfied without preserving the old FAISS payload.
_LEGACY_INDEX_BYTES = b"\x00"


@dataclass
class DocumentBundle:
    doc_id: str
    title: str
    narration: list[str]
    rag: list[str]
    # Parallel page-number arrays (None = page unknown, e.g. text upload).
    narration_pages: list[int | None] | None = None
    rag_pages: list[int | None] | None = None
    total_pages: int | None = None


class RagService:
    _instance: "RagService | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        s = get_settings()
        # --- HF embedding client config ---
        self._embed_model = s.huggingface_embed_model
        self._hf_token = s.huggingface_api_token
        if not self._hf_token:
            logger.warning(
                "HUGGINGFACE_API_TOKEN is not set; embedding calls will fail. "
                "Get a free token at https://huggingface.co/settings/tokens"
            )

        # --- Pinecone client config ---
        self._pc_api_key = s.pinecone_api_key
        self._pc_index_name = s.pinecone_index_name
        self._pc_cloud = s.pinecone_cloud
        self._pc_region = s.pinecone_region
        if not self._pc_api_key:
            logger.warning(
                "PINECONE_API_KEY is not set; vector storage will fail. "
                "Get a free key at https://app.pinecone.io"
            )

        logger.info(
            "RAG: embed=%s pinecone_index=%s",
            self._embed_model, self._pc_index_name,
        )

        self._http: httpx.Client | None = None  # HF Inference API client
        self._pc: Pinecone | None = None        # Pinecone client
        self._pc_index = None                   # Pinecone Index handle

        # Per-doc in-memory cache of chunk-text lists. We never cache vectors
        # in-process anymore — Pinecone is the index of record.
        self._cache: dict[str, list[str]] = {}

        self._root = s.storage_path / "rag"
        self._root.mkdir(parents=True, exist_ok=True)

        # Postgres mirror — same role as before, but only for chunks_json +
        # meta_json. The FAISS bytes path is dead.
        self._pg: Engine | None = None
        self._pg_unavailable: bool = False

    @classmethod
    def instance(cls) -> "RagService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    # ---- doc_id sanitisation ----
    def _doc_dir(self, doc_id: str) -> Path:
        validate_doc_id(doc_id)
        return safe_join(self._root, doc_id)

    # ---- Pinecone lazy init ------------------------------------------------

    def _pc_client(self) -> Pinecone:
        if self._pc is None:
            if not self._pc_api_key:
                raise RuntimeError(
                    "PINECONE_API_KEY is not configured; cannot reach vector store."
                )
            self._pc = Pinecone(api_key=self._pc_api_key)
        return self._pc

    def _index(self):
        """Return the Pinecone Index handle, creating the index if missing.

        Index creation is idempotent — ``has_index`` short-circuits when the
        index already exists, so the first call after a fresh deploy creates
        it and subsequent calls just attach.
        """
        if self._pc_index is not None:
            return self._pc_index
        pc = self._pc_client()
        try:
            exists = pc.has_index(self._pc_index_name)
        except AttributeError:
            # Older SDK versions don't expose has_index; fall back to list.
            exists = self._pc_index_name in [
                ix.name for ix in pc.list_indexes()
            ]
        if not exists:
            logger.info(
                "Pinecone: creating index %s (dim=%d, cosine, %s/%s)",
                self._pc_index_name, EMBED_DIM, self._pc_cloud, self._pc_region,
            )
            pc.create_index(
                name=self._pc_index_name,
                dimension=EMBED_DIM,
                metric="cosine",
                spec=ServerlessSpec(cloud=self._pc_cloud, region=self._pc_region),
            )
        self._pc_index = pc.Index(self._pc_index_name)
        return self._pc_index

    # ---- Postgres mirror (chunks_json + meta_json only) --------------------

    def _pg_engine(self) -> Engine | None:
        """Lazy sync SQLAlchemy engine for the rag_indices table.

        Returns None when no DATABASE_URL is configured (local dev with
        sqlite or no DB at all). Returns None sticky-permanently if the
        first connection raises — the caller falls back to disk-only mode.
        """
        if self._pg is not None:
            return self._pg
        if self._pg_unavailable:
            return None
        url = (get_settings().database_url or "").strip()
        if not url:
            self._pg_unavailable = True
            return None
        sync_url = url.replace("+asyncpg", "")
        sync_url = sync_url.replace("ssl=require", "sslmode=require")
        try:
            self._pg = create_engine(sync_url, pool_pre_ping=True, pool_recycle=300, future=True)
            with self._pg.connect() as c:
                c.execute(text("SELECT 1"))
            return self._pg
        except Exception as exc:
            logger.warning("rag: Postgres mirror unavailable (%s); disk-only mode", exc)
            self._pg = None
            self._pg_unavailable = True
            return None

    def _save_to_pg(self, doc_id: str, chunks_json: str, meta_json: str) -> None:
        """Mirror chunks + meta to Postgres. ``index_bytes`` gets a sentinel
        byte to satisfy the legacy NOT NULL constraint."""
        eng = self._pg_engine()
        if eng is None:
            return
        try:
            with eng.begin() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO rag_indices (doc_id, index_bytes, chunks_json, meta_json, updated_at)
                        VALUES (:doc_id, :index_bytes, :chunks_json, :meta_json, now())
                        ON CONFLICT (doc_id) DO UPDATE SET
                            index_bytes = EXCLUDED.index_bytes,
                            chunks_json = EXCLUDED.chunks_json,
                            meta_json   = EXCLUDED.meta_json,
                            updated_at  = now()
                        """
                    ),
                    {
                        "doc_id":      doc_id,
                        "index_bytes": _LEGACY_INDEX_BYTES,
                        "chunks_json": chunks_json,
                        "meta_json":   meta_json,
                    },
                )
        except Exception as exc:
            logger.warning("rag: failed to mirror to Postgres (%s)", exc)

    def _load_from_pg(self, doc_id: str) -> tuple[str, str] | None:
        """Return ``(chunks_json, meta_json)`` if the doc is mirrored, else None."""
        eng = self._pg_engine()
        if eng is None:
            return None
        try:
            with eng.connect() as conn:
                row = conn.execute(
                    text(
                        "SELECT chunks_json, meta_json "
                        "FROM rag_indices WHERE doc_id = :doc_id"
                    ),
                    {"doc_id": doc_id},
                ).first()
        except Exception as exc:
            logger.warning("rag: failed to read Postgres mirror (%s)", exc)
            return None
        if row is None:
            return None
        return row[0], row[1]

    def _hydrate_from_pg(self, doc_id: str) -> bool:
        """If a doc's chunks/meta live in Postgres but not on disk, restore
        them. Returns True iff hydration happened."""
        doc_dir = safe_join(self._root, doc_id)
        if (doc_dir / "chunks.json").exists():
            return False
        row = self._load_from_pg(doc_id)
        if row is None:
            return False
        chunks_json, meta_json = row
        doc_dir.mkdir(parents=True, exist_ok=True)
        (doc_dir / "chunks.json").write_text(chunks_json, encoding="utf-8")
        (doc_dir / "meta.json").write_text(meta_json, encoding="utf-8")
        logger.info("rag: hydrated doc=%s chunks/meta from Postgres mirror", doc_id)
        return True

    # ---- ingest ------------------------------------------------------------

    def ingest(
        self,
        doc_id: str,
        title: str,
        text: str,
        *,
        pages: list[tuple[int, str]] | None = None,
    ) -> DocumentBundle:
        """Chunk + embed + upsert into Pinecone + persist chunk text on disk.

        Two modes:
          - ``pages`` is None: legacy plain-text — no per-page citations.
          - ``pages`` is provided: page-aware mode. Each chunk records the
            page it came from so the UI can render "Page 12" instead of
            "chunk #3".
        """
        validate_doc_id(doc_id)

        rag_pages: list[int | None]
        narration_pages: list[int | None]
        if pages:
            rag_pairs = rag_chunks_with_pages(pages)
            narration_pairs = narration_chunks_with_pages(pages)
            rag = [c for c, _ in rag_pairs]
            rag_pages = [p for _, p in rag_pairs]
            narration = [c for c, _ in narration_pairs]
            narration_pages = [p for _, p in narration_pairs]
            total_pages = max((p for p, _ in pages), default=0) or None
        else:
            narration = narration_chunks(text)
            rag = rag_chunks(text)
            rag_pages = [None] * len(rag)
            narration_pages = [None] * len(narration)
            total_pages = None

        if not rag:
            raise ValueError("No content to index after chunking")

        # 1. Embed every RAG chunk via HF Inference API.
        embeddings = self._embed(rag)

        # 2. Upsert into Pinecone, namespaced by doc_id.
        # If this doc was previously ingested, wipe the namespace first so
        # stale vectors from a prior upload don't survive a re-ingest.
        index = self._index()
        try:
            index.delete(delete_all=True, namespace=doc_id)
        except Exception as exc:
            # A 404 here means the namespace simply doesn't exist yet, which
            # is the common case on first ingest. Log and continue.
            logger.debug("pinecone: pre-ingest delete skipped (%s)", exc)

        vectors = [
            {
                "id": f"{doc_id}#{i}",
                "values": embeddings[i].tolist(),
                "metadata": {
                    "chunk_idx": int(i),
                    "page": int(rag_pages[i]) if rag_pages[i] is not None else -1,
                },
            }
            for i in range(len(rag))
        ]
        for start in range(0, len(vectors), _PC_UPSERT_BATCH):
            batch = vectors[start : start + _PC_UPSERT_BATCH]
            index.upsert(vectors=batch, namespace=doc_id)

        # 3. Persist chunk text + meta on disk (used by narration, citations,
        # and the LangChain retriever's "give me chunk text by index" path).
        doc_dir = safe_join(self._root, doc_id)
        doc_dir.mkdir(parents=True, exist_ok=True)
        chunks_json = json.dumps({
            "rag": rag,
            "narration": narration,
            "rag_pages": rag_pages,
            "narration_pages": narration_pages,
        })
        meta_json = json.dumps({
            "doc_id": doc_id,
            "title": title,
            "n_rag": len(rag),
            "n_narration": len(narration),
            "total_pages": total_pages,
            "created_at": time.time(),
        })
        (doc_dir / "chunks.json").write_text(chunks_json, encoding="utf-8")
        (doc_dir / "meta.json").write_text(meta_json, encoding="utf-8")

        # 4. Mirror chunks/meta to Postgres so the doc survives Render's
        # disk wipe. Best-effort: DB outage must not fail an in-flight upload.
        try:
            self._save_to_pg(doc_id, chunks_json, meta_json)
        except Exception:
            logger.exception("rag: Postgres mirror write failed")

        # 5. Warm in-process chunk-text cache.
        self._cache[doc_id] = rag

        return DocumentBundle(
            doc_id=doc_id, title=title, narration=narration, rag=rag,
            narration_pages=narration_pages, rag_pages=rag_pages,
            total_pages=total_pages,
        )

    # ---- retrieve ----------------------------------------------------------

    def retrieve(self, doc_id: str, query: str, k: int = 4) -> list[str]:
        if not query.strip():
            return []
        chunks = self._load_chunks(doc_id)
        if not chunks:
            return []
        q_vec = self._embed([query])[0].tolist()
        result = self._index().query(
            namespace=doc_id,
            vector=q_vec,
            top_k=min(k, len(chunks)),
            include_metadata=True,
        )
        return [
            chunks[idx]
            for idx in self._chunk_idxs_from_matches(result)
            if 0 <= idx < len(chunks)
        ]

    def retrieve_with_indices(
        self, doc_id: str, query: str, k: int = 4
    ) -> list[tuple[int, str]]:
        """Same as :meth:`retrieve` but returns (chunk_idx, text) pairs.

        Used by the LangChain wrapper (``EchoVerseRetriever``) so downstream
        chains can carry the chunk index in Document metadata for citations.
        """
        if not query.strip():
            return []
        chunks = self._load_chunks(doc_id)
        if not chunks:
            return []
        q_vec = self._embed([query])[0].tolist()
        result = self._index().query(
            namespace=doc_id,
            vector=q_vec,
            top_k=min(k, len(chunks)),
            include_metadata=True,
        )
        out: list[tuple[int, str]] = []
        for idx in self._chunk_idxs_from_matches(result):
            if 0 <= idx < len(chunks):
                out.append((idx, chunks[idx]))
        return out

    @staticmethod
    def _chunk_idxs_from_matches(result) -> list[int]:
        """Pull ``chunk_idx`` (int) out of each match in a Pinecone query
        result. Robust to both attribute-style and dict-style match objects
        across SDK versions."""
        if hasattr(result, "matches"):
            matches = result.matches or []
        elif isinstance(result, dict):
            matches = result.get("matches", []) or []
        else:
            matches = []

        out: list[int] = []
        for m in matches:
            md = getattr(m, "metadata", None)
            if md is None and isinstance(m, dict):
                md = m.get("metadata")
            if not md:
                continue
            ci = md.get("chunk_idx") if hasattr(md, "get") else None
            if ci is None:
                continue
            try:
                out.append(int(ci))
            except (TypeError, ValueError):
                continue
        return out

    # ---- read-only helpers -------------------------------------------------

    def _read_chunks_json(self, doc_id: str) -> dict:
        doc_dir = self._doc_dir(doc_id)
        path = doc_dir / "chunks.json"
        if not path.exists():
            self._hydrate_from_pg(doc_id)
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def get_narration(self, doc_id: str) -> list[str]:
        return list(self._read_chunks_json(doc_id).get("narration", []))

    def get_rag_pages(self, doc_id: str) -> list[int | None]:
        data = self._read_chunks_json(doc_id)
        if "rag_pages" in data and isinstance(data["rag_pages"], list):
            return [(int(x) if x is not None else None) for x in data["rag_pages"]]
        return [None] * len(data.get("rag", []))

    def get_narration_pages(self, doc_id: str) -> list[int | None]:
        data = self._read_chunks_json(doc_id)
        if "narration_pages" in data and isinstance(data["narration_pages"], list):
            return [(int(x) if x is not None else None) for x in data["narration_pages"]]
        return [None] * len(data.get("narration", []))

    def get_meta(self, doc_id: str) -> dict:
        meta_path = self._doc_dir(doc_id) / "meta.json"
        if not meta_path.exists():
            self._hydrate_from_pg(doc_id)
        if not meta_path.exists():
            return {}
        return json.loads(meta_path.read_text(encoding="utf-8"))

    def n_rag_chunks(self, doc_id: str) -> int:
        meta_path = self._doc_dir(doc_id) / "meta.json"
        if meta_path.exists():
            n = json.loads(meta_path.read_text(encoding="utf-8")).get("n_rag")
            if isinstance(n, int):
                return n
        return len(self._load_chunks(doc_id))

    def exists(self, doc_id: str) -> bool:
        # exists() is called with raw user input; return False on bad IDs
        # rather than raising — the caller will turn it into a clean 404.
        try:
            doc_dir = self._doc_dir(doc_id)
        except Exception:
            return False
        if (doc_dir / "chunks.json").exists():
            return True
        # Disk wiped (e.g. Render free cold start). Check Postgres mirror;
        # if it has the doc, hydrate to disk so callers can proceed.
        return self._hydrate_from_pg(doc_id)

    # ---- delete ------------------------------------------------------------

    def delete(self, doc_id: str) -> None:
        """Remove a document's vectors from Pinecone and its Postgres mirror
        row. On-disk artifacts are cleaned up by the calling route (see
        ``api/documents.py``) so callers can decide if they want to keep
        chunks/meta cached locally. Best-effort: each failure is logged but
        does not abort the others."""
        validate_doc_id(doc_id)
        try:
            self._index().delete(delete_all=True, namespace=doc_id)
        except Exception:
            logger.exception("pinecone: delete namespace %s failed", doc_id)

        eng = self._pg_engine()
        if eng is not None:
            try:
                with eng.begin() as conn:
                    conn.execute(
                        text("DELETE FROM rag_indices WHERE doc_id = :doc_id"),
                        {"doc_id": doc_id},
                    )
            except Exception:
                logger.exception("rag: failed to delete Postgres mirror for %s", doc_id)

        self._cache.pop(doc_id, None)

    # ---- internals ---------------------------------------------------------

    def _load_chunks(self, doc_id: str) -> list[str]:
        """Return the RAG chunk-text array for a doc, cached in memory."""
        validate_doc_id(doc_id)
        cached = self._cache.get(doc_id)
        if cached is not None:
            return cached
        data = self._read_chunks_json(doc_id)
        if not data:
            return []
        chunks = list(data.get("rag", []))
        self._cache[doc_id] = chunks
        return chunks

    def _load(self, doc_id: str):
        """Back-compat shim for ``EchoVerseRetriever.fetch_all`` which expects
        a ``(index, chunks)`` tuple. The first element is no longer used —
        Pinecone is the index — so we return ``None`` for it.
        """
        chunks = self._load_chunks(doc_id)
        if not chunks:
            raise FileNotFoundError(f"No chunks available for doc_id={doc_id}")
        return None, chunks

    # ---- embeddings (HuggingFace Inference API) ----------------------------

    def _embed(self, texts: list[str]) -> np.ndarray:
        """Return ``(N, EMBED_DIM)`` float32 embeddings for ``texts``.

        Pinecone's ``metric="cosine"`` handles normalisation internally, so
        we don't normalise here. The output is raw HF feature-extraction
        vectors batched into a single numpy array for upstream code.
        """
        if not texts:
            return np.zeros((0, EMBED_DIM), dtype=np.float32)
        if not self._hf_token:
            raise RuntimeError(
                "HUGGINGFACE_API_TOKEN is not configured; cannot embed."
            )

        out: list[list[float]] = []
        for i in range(0, len(texts), _HF_BATCH_SIZE):
            batch = texts[i : i + _HF_BATCH_SIZE]
            out.extend(self._hf_embed_batch(batch))

        arr = np.asarray(out, dtype=np.float32)
        if arr.ndim != 2 or arr.shape[1] != EMBED_DIM:
            raise RuntimeError(
                f"HF embedding shape mismatch: got {arr.shape}, "
                f"expected (*, {EMBED_DIM})"
            )
        return arr

    def _hf_client(self) -> httpx.Client:
        if self._http is None:
            self._http = httpx.Client(
                timeout=_HF_TIMEOUT_S,
                headers={
                    "Authorization": f"Bearer {self._hf_token}",
                    "Accept": "application/json",
                },
            )
        return self._http

    def _hf_embed_batch(self, batch: list[str]) -> list[list[float]]:
        """Call the HF Inference API once for up to ``_HF_BATCH_SIZE`` strings.

        On 503 ("model is loading") we retry once with ``wait_for_model`` so
        the first cold call after deploy doesn't fail spuriously.
        """
        url = f"{_HF_BASE_URL}/{self._embed_model}"
        client = self._hf_client()
        payload: dict = {"inputs": batch, "options": {"wait_for_model": True}}

        for attempt in (1, 2):
            try:
                resp = client.post(url, json=payload)
            except httpx.HTTPError as exc:
                if attempt == 1:
                    logger.warning("HF embed transport error (%s); retrying", exc)
                    continue
                raise RuntimeError(f"HF embed request failed: {exc}") from exc

            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data and isinstance(data[0], (int, float)):
                    data = [data]
                if not isinstance(data, list):
                    raise RuntimeError(
                        f"HF embed: unexpected response shape: {type(data).__name__}"
                    )
                return data

            if resp.status_code == 503 and attempt == 1:
                logger.info(
                    "HF model loading (status 503); retrying once with wait_for_model"
                )
                continue

            raise RuntimeError(
                f"HF embed HTTP {resp.status_code}: {resp.text[:200]}"
            )

        raise RuntimeError("HF embed: exhausted retries")


def get_rag() -> RagService:
    return RagService.instance()
