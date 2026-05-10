"""FAISS-backed RAG service.

Per-document index files live under STORAGE_DIR/rag/{doc_id}/
  - index.faiss : the FAISS vector index
  - chunks.json : the original text chunks, parallel to index rows
  - meta.json   : document metadata (title, n_chunks, created_at)
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

from backend.config.settings import get_settings
from backend.utils.chunker import narration_chunks, rag_chunks

logger = logging.getLogger(__name__)

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_DIM = 384


@dataclass
class DocumentBundle:
    doc_id: str
    title: str
    narration: list[str]
    rag: list[str]


class RagService:
    _instance: "RagService | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        logger.info("Loading embedding model: %s", EMBED_MODEL)
        self._embedder = SentenceTransformer(EMBED_MODEL)
        self._root = get_settings().storage_path / "rag"
        self._root.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, tuple[faiss.Index, list[str]]] = {}

    @classmethod
    def instance(cls) -> "RagService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    # ---- ingest ----
    def ingest(self, doc_id: str, title: str, text: str) -> DocumentBundle:
        narration = narration_chunks(text)
        rag = rag_chunks(text)
        if not rag:
            raise ValueError("No content to index after chunking")

        embeddings = self._embed(rag)
        index = faiss.IndexFlatIP(EMBED_DIM)
        index.add(embeddings)

        doc_dir = self._root / doc_id
        doc_dir.mkdir(parents=True, exist_ok=True)
        faiss.write_index(index, str(doc_dir / "index.faiss"))
        (doc_dir / "chunks.json").write_text(
            json.dumps({"rag": rag, "narration": narration}), encoding="utf-8"
        )
        (doc_dir / "meta.json").write_text(
            json.dumps(
                {
                    "doc_id": doc_id,
                    "title": title,
                    "n_rag": len(rag),
                    "n_narration": len(narration),
                    "created_at": time.time(),
                }
            ),
            encoding="utf-8",
        )

        # Warm cache
        self._cache[doc_id] = (index, rag)
        return DocumentBundle(doc_id=doc_id, title=title, narration=narration, rag=rag)

    # ---- retrieve ----
    def retrieve(self, doc_id: str, query: str, k: int = 4) -> list[str]:
        index, chunks = self._load(doc_id)
        if not query.strip():
            return []
        q = self._embed([query])
        scores, ids = index.search(q, min(k, len(chunks)))
        return [chunks[i] for i in ids[0] if 0 <= i < len(chunks)]

    # ---- read-only helpers ----
    def get_narration(self, doc_id: str) -> list[str]:
        doc_dir = self._root / doc_id
        data = json.loads((doc_dir / "chunks.json").read_text(encoding="utf-8"))
        return list(data.get("narration", []))

    def get_meta(self, doc_id: str) -> dict:
        return json.loads((self._root / doc_id / "meta.json").read_text(encoding="utf-8"))

    def n_rag_chunks(self, doc_id: str) -> int:
        meta_path = self._root / doc_id / "meta.json"
        if meta_path.exists():
            n = json.loads(meta_path.read_text(encoding="utf-8")).get("n_rag")
            if isinstance(n, int):
                return n
        _, chunks = self._load(doc_id)
        return len(chunks)

    def exists(self, doc_id: str) -> bool:
        return (self._root / doc_id / "index.faiss").exists()

    # ---- internals ----
    def _load(self, doc_id: str) -> tuple[faiss.Index, list[str]]:
        if doc_id in self._cache:
            return self._cache[doc_id]
        doc_dir = self._root / doc_id
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
