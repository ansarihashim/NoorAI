"""FAISS-backed RAG service.

Per-document index files live under STORAGE_DIR/rag/{doc_id}/
  - index.faiss : the FAISS vector index
  - chunks.json : the original text chunks, parallel to index rows
  - meta.json   : document metadata (title, n_chunks, created_at)

On hosts without a persistent disk (Render free, Fly free, etc.) the disk
gets wiped on every redeploy. To keep documents queryable across cold
starts, we ALSO mirror each ingest to the ``rag_indices`` Postgres table
(see ``app/db/migrations/versions/0003_rag_indices.py``). On read, if the
on-disk artifacts are missing we hydrate them back from Postgres before
proceeding. Disk stays the hot path; Postgres is only touched when
necessary.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
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

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_DIM = 384


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
        logger.info("Loading embedding model: %s", EMBED_MODEL)
        self._embedder = SentenceTransformer(EMBED_MODEL)
        self._root = get_settings().storage_path / "rag"
        self._root.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, tuple[faiss.Index, list[str]]] = {}
        self._pg: Engine | None = None  # lazy
        self._pg_unavailable: bool = False  # sticky: don't keep retrying

    @classmethod
    def instance(cls) -> "RagService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    # ---- doc_id sanitisation ----
    # Every public method funnels its on-disk lookup through this helper.
    # Any doc_id that doesn't match the strict regex (or escapes the storage
    # root) is rejected before we touch the filesystem.
    def _doc_dir(self, doc_id: str) -> Path:
        validate_doc_id(doc_id)
        return safe_join(self._root, doc_id)

    # ---- Postgres mirror (for hosts without persistent disk) -------------

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
        # SQLAlchemy sync engines need a sync driver. Our app uses
        # postgresql+asyncpg://… for the async stack; strip the suffix.
        sync_url = url.replace("+asyncpg", "")
        # asyncpg uses ?ssl=require; psycopg2 uses ?sslmode=require.
        sync_url = sync_url.replace("ssl=require", "sslmode=require")
        try:
            self._pg = create_engine(sync_url, pool_pre_ping=True, pool_recycle=300, future=True)
            # Cheap probe so a bad URL fails fast.
            with self._pg.connect() as c:
                c.execute(text("SELECT 1"))
            return self._pg
        except Exception as exc:
            logger.warning("rag: Postgres mirror unavailable (%s); disk-only mode", exc)
            self._pg = None
            self._pg_unavailable = True
            return None

    def _save_to_pg(self, doc_id: str, index_bytes: bytes, chunks_json: str, meta_json: str) -> None:
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
                        "index_bytes": index_bytes,
                        "chunks_json": chunks_json,
                        "meta_json":   meta_json,
                    },
                )
        except Exception as exc:
            # Table missing (migration not run yet) or transient DB issue —
            # don't fail the user's upload over this; disk write already
            # succeeded.
            logger.warning("rag: failed to mirror to Postgres (%s)", exc)

    def _load_from_pg(self, doc_id: str) -> tuple[bytes, str, str] | None:
        eng = self._pg_engine()
        if eng is None:
            return None
        try:
            with eng.connect() as conn:
                row = conn.execute(
                    text(
                        "SELECT index_bytes, chunks_json, meta_json "
                        "FROM rag_indices WHERE doc_id = :doc_id"
                    ),
                    {"doc_id": doc_id},
                ).first()
        except Exception as exc:
            logger.warning("rag: failed to read Postgres mirror (%s)", exc)
            return None
        if row is None:
            return None
        return bytes(row[0]), row[1], row[2]

    def _hydrate_from_pg(self, doc_id: str) -> bool:
        """If a doc lives in Postgres but not on disk, write it to disk.

        Returns True iff hydration happened (caller can now read from disk).
        """
        doc_dir = safe_join(self._root, doc_id)
        if (doc_dir / "index.faiss").exists():
            return False
        row = self._load_from_pg(doc_id)
        if row is None:
            return False
        index_bytes, chunks_json, meta_json = row
        doc_dir.mkdir(parents=True, exist_ok=True)
        (doc_dir / "index.faiss").write_bytes(index_bytes)
        (doc_dir / "chunks.json").write_text(chunks_json, encoding="utf-8")
        (doc_dir / "meta.json").write_text(meta_json, encoding="utf-8")
        logger.info("rag: hydrated doc=%s from Postgres mirror", doc_id)
        return True

    # ---- ingest ----
    def ingest(
        self,
        doc_id: str,
        title: str,
        text: str,
        *,
        pages: list[tuple[int, str]] | None = None,
    ) -> DocumentBundle:
        """Chunk + embed + persist a document.

        Two modes:
          - ``pages`` is None: legacy plain-text — no per-page citations.
          - ``pages`` is provided: page-aware mode. Each chunk records the
            page it came from so the UI can render "Page 12" instead of
            "chunk #3".

        ``text`` is still accepted in page-aware mode for callers that want
        to pass a flat string for fallback; if both are present, ``pages``
        wins.
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

        embeddings = self._embed(rag)
        index = faiss.IndexFlatIP(EMBED_DIM)
        index.add(embeddings)

        doc_dir = safe_join(self._root, doc_id)
        doc_dir.mkdir(parents=True, exist_ok=True)
        faiss.write_index(index, str(doc_dir / "index.faiss"))
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

        # Mirror to Postgres so the doc survives disk wipes on ephemeral
        # hosts. Best-effort: a DB outage must not fail an in-flight upload.
        try:
            index_bytes = bytes(faiss.serialize_index(index))
            self._save_to_pg(doc_id, index_bytes, chunks_json, meta_json)
        except Exception:
            logger.exception("rag: serializing FAISS for Postgres mirror failed")

        # Warm cache
        self._cache[doc_id] = (index, rag)
        return DocumentBundle(
            doc_id=doc_id, title=title, narration=narration, rag=rag,
            narration_pages=narration_pages, rag_pages=rag_pages,
            total_pages=total_pages,
        )

    # ---- retrieve ----
    def retrieve(self, doc_id: str, query: str, k: int = 4) -> list[str]:
        index, chunks = self._load(doc_id)
        if not query.strip():
            return []
        q = self._embed([query])
        scores, ids = index.search(q, min(k, len(chunks)))
        return [chunks[i] for i in ids[0] if 0 <= i < len(chunks)]

    def retrieve_with_indices(
        self, doc_id: str, query: str, k: int = 4
    ) -> list[tuple[int, str]]:
        """Same as :meth:`retrieve` but returns (chunk_idx, text) pairs.

        Used by the LangChain wrapper (``EchoVerseRetriever``) so downstream
        chains can carry the chunk index in Document metadata for citations.
        Without this method every chain call to the wrapper raises
        AttributeError, the chain swallows it, and the context silently
        becomes "(no notes available)" — which is what was breaking the
        Simplest-Explanation feature.
        """
        index, chunks = self._load(doc_id)
        if not query.strip():
            return []
        q = self._embed([query])
        _scores, ids = index.search(q, min(k, len(chunks)))
        return [(int(i), chunks[i]) for i in ids[0] if 0 <= i < len(chunks)]

    # ---- read-only helpers ----
    def _read_chunks_json(self, doc_id: str) -> dict:
        """Read chunks.json from disk, hydrating from Postgres on miss."""
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
        """Parallel array to the RAG chunk list. ``None`` if page unknown."""
        data = self._read_chunks_json(doc_id)
        if "rag_pages" in data and isinstance(data["rag_pages"], list):
            return [(int(x) if x is not None else None) for x in data["rag_pages"]]
        # Legacy doc — no page metadata captured at ingest time.
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
        _, chunks = self._load(doc_id)
        return len(chunks)

    def exists(self, doc_id: str) -> bool:
        # exists() is called with raw user input; return False on bad IDs
        # rather than raising — the caller will turn it into a clean 404.
        try:
            doc_dir = self._doc_dir(doc_id)
        except Exception:
            return False
        if (doc_dir / "index.faiss").exists():
            return True
        # Disk wiped (e.g. Render free cold start). Check Postgres mirror;
        # if it has the doc, hydrate to disk so callers can proceed.
        return self._hydrate_from_pg(doc_id)

    # ---- internals ----
    def _load(self, doc_id: str) -> tuple[faiss.Index, list[str]]:
        validate_doc_id(doc_id)
        if doc_id in self._cache:
            return self._cache[doc_id]
        doc_dir = safe_join(self._root, doc_id)
        if not (doc_dir / "index.faiss").exists():
            self._hydrate_from_pg(doc_id)
        if not (doc_dir / "index.faiss").exists():
            raise FileNotFoundError(f"No FAISS index for doc_id={doc_id}")
        index = faiss.read_index(str(doc_dir / "index.faiss"))
        data = json.loads((doc_dir / "chunks.json").read_text(encoding="utf-8"))
        rag = list(data.get("rag", []))
        self._cache[doc_id] = (index, rag)
        return index, rag

    def _embed(self, texts: list[str]) -> np.ndarray:
        emb = self._embedder.encode(
            texts,
            normalize_embeddings=True,    # cosine via inner product
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return emb.astype(np.float32)


def get_rag() -> RagService:
    return RagService.instance()
