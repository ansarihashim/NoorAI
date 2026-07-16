# NoorAI (a.k.a. EchoVerse) — Full Project Context

> **Purpose of this document.** A complete, self-contained snapshot of the project *as it exists today* — what it does, how it's built, every major strategy and design decision, and (critically) where it is **not** production-grade. It is written to be pasted into a fresh chat as context so a rebuild toward production (latency, cost, efficiency, scalability, reliability) can start with full understanding of the current system.
>
> Built ~2 months ago as an early-stage project. It works end-to-end and is deployed, but the architecture reflects a beginner's priorities (get it working, keep it free) rather than production priorities (scale, cost control, observability, resilience). Sections 12–13 are the honest "what to fix" list.

---

## 1. What the product is

**One-liner:** Upload your study notes (PDF/text) → the app turns them into an AI study workspace: it narrates them aloud, generates a two-host "study podcast," builds exam-prep material (overviews, important questions, simplest explanations), builds revision material (flashcards, quizzes, active recall, viva, night-before crammers), draws concept diagrams, and answers grounded questions about the notes.

**Two names, one product (important history):**
- The repo/codebase is called **EchoVerse** (FastAPI app title is still `"EchoVerse"`; README describes a *"Real-Time Bidirectional AI Voice Agent"* with voice barge-in).
- The product was **rebranded to NoorAI** and **pivoted**. The original "interrupt the narration with your voice and it answers" feature (**voice barge-in**) — powered by faster-whisper (STT) + VAD — **was removed entirely**. Narration is now a **one-way listen** experience.
- **The README is partly stale.** It still mentions `faster-whisper (local CPU)` and `FAISS`. Neither is used anymore. The live system uses **HuggingFace Inference API** for embeddings and **Pinecone serverless** for vectors. Don't trust the README's stack line; trust this document and the code.

**Current shape:** a document-centric "AI study notebook" (think NotebookLM-style), not a voice agent.

---

## 2. High-level architecture

```
┌─────────────────────────────┐        HTTPS (REST)         ┌──────────────────────────────┐
│  Frontend (React SPA)       │ ─────────────────────────▶ │  Backend (FastAPI, async)     │
│  Vercel                     │ ◀───────────────────────── │  Render (free tier)           │
│                             │        WSS (/ws/audio)      │                              │
│  - marketing/landing        │ ◀═══════════════════════▶  │  - REST API (11 routers)      │
│  - auth (JWT in session)    │   server-push MP3 + JSON    │  - WebSocket audio push       │
│  - workspace (3-col)        │                             │  - RAG service                │
│  - demo mode (offline)      │                             │  - LLM chains (LangChain)     │
└─────────────────────────────┘                             │  - LangGraph state machine    │
                                                            │  - TTS (2-tier fallback)      │
                                                            └───────────┬──────────────────┘
                                                                        │
             ┌──────────────────────┬──────────────────────┬───────────┼───────────────┐
             ▼                      ▼                      ▼           ▼               ▼
        Groq LLM            HF Inference API          Pinecone     PostgreSQL     ElevenLabs / Edge-TTS
   (llama-3.3-70b)         (MiniLM embeddings)      (vectors,384d)  (Neon)          (audio synthesis)
```

**All heavy compute is on hosted third-party APIs** (Groq, HF, Pinecone, ElevenLabs). The backend itself holds **no local ML models** — a deliberate choice to fit Render's free 512 MB dyno (the README notes this saved ~500 MB RAM vs local sentence-transformers + FAISS).

**Everything (except the Postgres relational tables) is stored as JSON files on disk**, mirrored to Postgres because the host disk is ephemeral. This is the single biggest architectural smell (see §12).

---

## 3. Tech stack (exact versions)

### Backend (`backend/`, Python 3.11)
| Concern | Choice | Version |
|---|---|---|
| Web framework | FastAPI | 0.115.5 |
| ASGI server | Uvicorn[standard] | 0.32.1 |
| WebSockets | websockets | 13.1 |
| Validation/config | Pydantic / pydantic-settings | 2.10.3 / 2.6.1 |
| LLM provider | Groq (`llama-3.3-70b-versatile`) | groq 0.13.0 |
| LLM orchestration | LangChain-core + langchain-groq | 0.3.72 / 0.2.4 |
| State machine | LangGraph | 0.2.55 |
| Embeddings | HuggingFace Inference API (`all-MiniLM-L6-v2`, 384-dim) | via httpx |
| Vector store | Pinecone serverless (cosine, per-doc namespace) | 5.4.2 |
| PDF parsing | pypdf | 5.1.0 |
| TTS primary | ElevenLabs (`eleven_turbo_v2_5`) | 1.50.3 |
| TTS fallback | edge-tts (`en-US-AriaNeural`, free) | 7.2.8 |
| DB | PostgreSQL (Neon) via SQLAlchemy async + asyncpg | 2.0.36 / 0.30.0 |
| Migrations | Alembic | 1.14.0 |
| Auth | bcrypt + PyJWT (HS256) | 5.0.0 / 2.10.1 |
| HTTP client | httpx | 0.28.1 |

### Frontend (`frontend/`, JavaScript — no TypeScript)
| Concern | Choice | Version |
|---|---|---|
| UI | React (hooks only) | 18.3.1 |
| Routing | react-router-dom | 6.28.0 |
| Build | Vite | 6.0.3 |
| Styling | Tailwind CSS + PostCSS | 3.4.16 |
| Animation | framer-motion | 12.38.0 |
| Diagrams | mermaid | 11.14.0 |
| Sanitization | dompurify | 3.4.2 |
| State | React Context only (no Redux/Zustand) | — |

**Deploy:** Frontend → **Vercel** (static `dist/`, SPA rewrites, manual `react-vendor`/`motion-vendor` chunk splitting). Backend → **Render** free tier (Blueprint in `backend/render.yaml`; also has a `Dockerfile`).

---

## 4. Core user flow

1. **Land** on marketing page (`/`) → **Sign up / log in** (or click "Try the demo").
2. **Dashboard** (`/app`): upload a PDF/`.txt`/`.md` (paste or file). Upload triggers backend ingest (chunk → embed → upsert to Pinecone → persist chunks JSON + mirror to Postgres). First narration chunk is pre-warmed.
3. Redirect to **Session** (`/app/session/:docId`) — a persistent **3-column workspace**:
   - **Left rail (Sources):** notebook index; searchable doc list; checkboxes to select one or more docs as the active "study scope" (multi-doc).
   - **Center:** the active **cognitive mode** (Narration / Podcast / Preparation / Revision).
   - **Right rail (AI Studio):** mode-contextual action buttons (e.g. "Generate flashcards") that set `?action=…` query params the center view consumes; in podcast mode it becomes the transcript panel.
4. User switches modes via the **ModeRail**. Each mode lazily fetches cached output, shows an empty state, and generates on demand.

**Multi-doc is a first-class concept:** Preparation endpoints accept `doc_ids: list[str]` (max 10) so a user can prepare across an entire syllabus. Revision + narration + podcast + visuals are **per single doc**.

---

## 5. Feature catalog

### Listen
- **Narration** — document split into ~600-char chunks; each chunk synthesized to MP3 and streamed. One-way listening with a full player (play/pause, ±15s skip, prev/next chunk, 0.5–2.5× speed, volume, position resume via localStorage). Prefetches 2–3 chunks ahead.
- **Podcast** — Groq writes a **host/guest dialogue** (14–22 turns) grounded in the notes; each turn is synthesized with a distinct voice (host = Rachel, guest = Adam) and played back with a synced scrolling transcript. Script + per-turn audio are cached to disk.

### Prepare (multi-doc)
- **Overview** — a structured "syllabus map": 6–14 topics with summaries, importance ratings, source-chunk citations, and an optional Mermaid diagram. Built via a **LangGraph** pipeline with validation + retry.
- **Important Questions** — high-yield exam questions grounded in cited chunks.
- **Simplest Explanation** — user types a topic; AI explains it ELI5, grounded in the notes.

### Revise (per-doc)
- **Flashcards**, **Quiz** (MCQ + conceptual), **Active Recall** (brain-dump prompts), **Quick Revision** (TL;DR), **Night Before** (dense crammer), **Viva** (oral-exam prompts). All produced by dedicated LLM chains with **grounded chunk citations**.

### Other
- **Visuals** — generate a single Mermaid diagram (flowchart/mindmap/sequence/timeline/etc.) from the notes, with a custom validator + LLM auto-repair loop for broken syntax.
- **Q&A** (`/api/llm/answer`) — streaming, grounded answer over retrieved chunks (RAG). Note: the UI's original voice "ask a doubt" entry point was removed; this endpoint still exists.

---

## 6. RAG system (the technical core) — `backend/app/rag/`

### 6.1 Chunking (`chunker.py`)
- Sentence-split (regex on `.!?` followed by capital/quote/paren), greedily packed to target sizes.
- **Two chunk streams per document:**
  - **Narration chunks** — target **600 chars** (~40–50s of speech).
  - **RAG chunks** — target **800 chars** with **120-char overlap** (more context for retrieval).
- **Page-aware mode** for PDFs: chunks never span a page boundary, and each chunk is tagged with its 1-based page number → enables human-readable "Page 12" citations. Plain-text uploads use a single stream with no page numbers.

### 6.2 Embeddings + vector store (`service.py`)
- **Embeddings:** `sentence-transformers/all-MiniLM-L6-v2` (**384-dim**) via **HF Inference API** router (`router.huggingface.co/hf-inference/models/...`). Batches of 64, 60s timeout, one retry on 503 "model loading."
- **Vectors:** **Pinecone serverless** — one index (`noorai-rag`), **one namespace per `doc_id`** (retrieval isolation by construction), cosine metric, index auto-created on first use. Each vector carries `{chunk_idx, page}` metadata. Re-ingest wipes the namespace first.
- **Chunk text is NOT stored in Pinecone** — only vectors + `chunk_idx`. The actual text lives on disk (`storage/rag/{doc_id}/chunks.json`) and query results map `chunk_idx` → text.
- **Retrieval:** embed query → Pinecone top-k (default k=4) → pull `chunk_idx` from matches → return chunk text. A `retrieve_with_indices` variant keeps indices for citation metadata.

### 6.3 Persistence & the ephemeral-disk workaround
- On-disk per doc: `storage/rag/{doc_id}/chunks.json` (rag + narration chunk arrays + parallel page arrays) and `meta.json` (title, counts, pages, created_at).
- **Because Render free has no persistent disk**, `chunks.json` + `meta.json` are **mirrored to a Postgres `rag_indices` table**. On read, if the disk artifact is missing (cold start after redeploy), it's **hydrated back from Postgres**. Pinecone vectors are durable independently.
- Legacy FAISS `index_bytes` column still exists (NOT NULL) but is dead — written with a single sentinel byte `b"\x00"`.

### 6.4 LLM chains (`rag/chains/`, `rag/prompts/`, `rag/schemas/`)
Every generated study artifact is produced by a **LangChain LCEL chain** ending in `ChatGroq(...).with_structured_output(PydanticSchema)` — i.e. the model is forced to return validated JSON. Common shape:
```python
RunnablePassthrough.assign(context=RunnableLambda(_build_context))
  | RunnableLambda(extract_fields)
  | PROMPT
  | ChatGroq(...).with_structured_output(Schema)
```

| Chain | Retrieval | Temp | Max tok | Output schema |
|---|---|---|---|---|
| Overview | all chunks (multi-doc) | 0.3 | 3500 | `OverviewMap` |
| Important Questions | all chunks (multi-doc) | 0.4 | 3500 | `ImportantQuestionSet` |
| Explanation | top-k per topic (multi-doc) | 0.5 | 2400 | `SimpleExplanation` |
| Flashcard | all chunks | 0.4 | 2400 | `FlashcardSet` |
| Quiz | all chunks | 0.4 | 3000 | `QuizSet` |
| Recall | all chunks | 0.5 | 2400 | `RecallSet` |
| Viva | all chunks | 0.5 | 2800 | `VivaSet` |
| Night Before | all chunks | 0.3 | 2400 | `NightBeforeSet` |
| Quick Revision | all chunks | 0.3 | 2400 | `QuickRevisionSet` |

**Grounding contract:** every generated item carries `chunks`/`grounded_chunks: list[int]` (indices of the source chunks it cites). These are **validated against the doc's chunk count** — out-of-bounds citations are rejected and the generation is retried (up to 2 attempts). Context is wrapped in `<NOTES>…</NOTES>` and literal boundary markers in the text are neutralized to blunt prompt injection.

### 6.5 LangGraph state machine (`rag/graphs/preparation_graph.py`)
Only **Overview** uses a graph (the others are single chains) because it has real branching:
```
ingest → analyze → validate ─ ok ──▶ END
                     │
                     └─ invalid & attempts<2 ─▶ analyze (retry)
                     └─ invalid & attempts≥2  ─▶ END
```
`validate` checks chunk-ref validity and Mermaid syntax (Mermaid is repaired or dropped as non-critical). `MAX_ATTEMPTS = 2`. Compiled once (module singleton).

---

## 7. Services layer — `backend/app/services/`

- **`groq.py`** — singleton `AsyncGroq` wrapper. Methods: `answer` (streaming Q&A, temp 0.4/350 tok, keeps last 6 history turns), `refine` (narration polish), `generate_mermaid` + `repair_mermaid` (visuals, `json_object` format), `generate_podcast` (host/guest script). System prompts are long and carefully tuned (spoken cadence, grounding, Mermaid syntax rules).
- **`tts.py`** — **two-tier fallback**: ElevenLabs streaming (primary) → **Edge-TTS** (free, always-on). ElevenLabs is **sticky-disabled** on 401/402/403 for the process lifetime. Daily char budget (default 50k) tracked in-process. If tier-1 emits partial bytes then errors, it re-raises (won't stitch a broken MP3 from two providers).
- **`narration.py`** — per-chunk MP3 cache at `storage/narration/{doc_id}/{voice_fingerprint}/chunk_NNNN.mp3`. Voice fingerprint (SHA1 of voice id) means a voice change auto-invalidates cache. In-process `_INFLIGHT` future-dict coalesces duplicate synthesis. `spawn_prefetch` (fire-and-forget, ≤2 concurrent).
- **`podcast.py`** — script cached at `storage/podcast/{doc_id}.json`; per-turn audio at `.../{voice_fingerprint}/turn_NNN.mp3`. Robust JSON extraction (tolerates fences / nested keys). `MAX_TURNS=32`. Context capped at ~12k chars. `_INFLIGHT_TURNS` dedup + `spawn_prefetch_turns`.
- **`visual.py`** — Mermaid generation + custom validator + repair loop; visuals cached per `(prompt, style)` hash. Supports flowchart/graph/mindmap/sequence/class/state/er/journey/gantt/timeline/etc.
- **`preparation.py`** — multi-doc orchestration. Cache key = `sha1(sorted(doc_ids))[:12]`. Overview via LangGraph; questions/explanation via chains with validate-and-retry (2 attempts). `_INFLIGHT` dedup.
- **`revision.py`** — orchestrates the 6 revision chains; same cache-then-generate-then-validate pattern, `storage/revision/{doc_id}/{feature}.json`.
- **`session.py`** — per-WebSocket FSM: `IDLE → NARRATING → IDLE` and `IDLE → PODCAST_GENERATING → PODCAST_PLAYING → IDLE`. Streams TTS bytes + transcript/cursor JSON. Cursor enables resume. **No barge-in** (Whisper/VAD removed; binary/mic frames dropped).

**Universal generation pattern:** `check disk cache → (if miss) in-process inflight-future dedup → asyncio.to_thread(chain.invoke) → validate grounding → write JSON cache`.

---

## 8. API surface — `backend/app/api/` + `backend/app/websocket/`

Mounted in `main.py` under these prefixes: `/api/auth`, `/api` (upload), `/api/documents`, `/api/llm`, `/api/tts`, `/api/narration`, `/api/podcast`, `/api/visuals`, `/api/preparation`, `/api/revision`, `/api/voices`, and `/ws/audio`.

- **Auth:** `POST /register`, `POST /login`, `GET /me`, `POST /logout` (login rate-limited).
- **Upload:** `POST /api/upload/text`, `POST /api/upload/file` (extension allowlist + MIME + PDF magic-byte check + byte caps), `GET /api/upload/{doc_id}`.
- **Documents:** `GET /api/documents` (⚠ no pagination), `GET /{doc_id}/citations`, `DELETE /{doc_id}` (cascades Pinecone + Postgres + disk, best-effort).
- **LLM:** `POST /api/llm/answer` → streaming grounded answer.
- **TTS:** `POST /api/tts/synthesize` → streaming MP3.
- **Narration:** `GET /{doc_id}/manifest`, `GET /{doc_id}/chunk/{idx}.mp3` (**token via query string** because `<audio>` can't set headers; 24h cache), `POST /{doc_id}/prefetch`.
- **Podcast:** `GET /{doc_id}`, `POST /{doc_id}/generate` (429 if TTS budget < 600 chars; prefetches turns 0–2), `GET /{doc_id}/turn/{idx}.mp3`.
- **Visuals:** `POST /{doc_id}/generate`, `GET /{doc_id}` (⚠ no pagination), `GET/DELETE /{doc_id}/{visual_id}`.
- **Preparation (all POST so `doc_ids` array fits in body):** overview / questions / explanation, each with `/generate`, fetch, and (some) `/delete`.
- **Revision:** for each of flashcards/quiz/recall/quick-revision/night-before/viva → `POST /{doc_id}/{feature}/generate`, `GET`, `DELETE`.
- **Voices:** `GET /api/voices`, `GET /{voice_id}/preview.mp3` (auto-synthesized, cached 24h).
- **WebSocket `/ws/audio?token=<JWT>`:** server-push. Inbound JSON control (`start_narration`/`start_podcast`/`stop`/`resume`/`ping`); outbound JSON state/transcript/cursor + **binary MP3 frames**. Guards: origin allowlist, JWT check, 180s idle timeout, 100 msg/s cap, 4 KiB text-frame cap, binary frames dropped.

---

## 9. Data model & storage

### PostgreSQL (relational — the only durable "real DB")
- `users(id, email UNIQUE, password_hash, display_name, created_at)`
- `documents(id, user_id→users, title, n_chunks, created_at)`
- `sessions(id, user_id, document_id→documents, started_at, ended_at, seconds_used)` + `messages(id, session_id, role, text, created_at)` — **defined but barely used**; the live app doesn't persist study sessions/messages meaningfully (the WS `Session` is in-memory).
- `rag_indices(doc_id PK, index_bytes, chunks_json, meta_json, updated_at)` — the disk mirror.

IDs are 32-char uuid hex (doc ids truncated to 16 hex on upload).

### Filesystem (`STORAGE_DIR`, `/tmp/storage` on Render — **ephemeral**)
```
storage/
  rag/{doc_id}/chunks.json, meta.json
  narration/{doc_id}/{voice_fp}/chunk_NNNN.mp3
  podcast/{doc_id}.json  +  {doc_id}/{voice_fp}/turn_NNN.mp3
  preparation/{set_key}/overview.json | questions.json | explanation_*.json
  revision/{doc_id}/{feature}.json
  visuals/{doc_id}/{visual_id}.json
```
**All generated study artifacts are JSON/MP3 files on disk.** Only RAG chunks/meta are mirrored to Postgres — **everything else (podcasts, revision sets, preparation output, visuals, cached audio) is lost on redeploy/cold start** and must be regenerated (extra cost + latency).

---

## 10. Auth & security

- **JWT (HS256)**, stateless. Claims `{sub, iat, exp}`, TTL default 60 min. `JWT_SECRET` is Render-`generateValue` (⚠ regenerates and invalidates all tokens if not pinned in the dashboard).
- **bcrypt** password hashing (72-byte truncation).
- Frontend stores the JWT in **sessionStorage** (session-scoped: closing the browser forces re-login; per-tab, not shared) — a deliberate shared-PC UX choice, and defence-in-depth on top of `exp`. Client fail-closed expiry check; 401 → wipe storage + `auth:unauthorized` event → bounce to `/login`.
- **CORS**: strict allowlist (no wildcard) + `allow_credentials`. WebSocket does an equivalent origin-allowlist check. Security headers + generic 500 handler via `install_security`. Input validation utils: `validate_doc_id`, `safe_join`, filename sanitization, upload magic-byte checks, rate-limit deps.

---

## 11. Frontend architecture — `frontend/src/`

- **Providers (in `main.jsx`):** `ErrorBoundary → BrowserRouter → SoundProvider → ToastProvider → AuthProvider → App`.
- **Routing (`App.jsx`):** marketing pages eager-loaded; workspace (`/app/*`) lazy-loaded behind `ProtectedRoute`. `/login` + `/signup` behind a `PublicOnly` guard.
- **Workspace state (`WorkspaceContext.jsx`):** single context at the shell holds `docs`, `activeScope` (selected source set, persisted to localStorage), rail collapse flags, and `activeMode` — kept in one place to avoid re-render storms during audio playback.
- **`useAudio` hook** — the audio engine. A unified HTML5 `<audio>` wrapper treating narration chunks / podcast turns as a **chapter playlist** with a global timeline, auto-advance, seek (chapter + global), ±15s skip, speed, volume. Uses a web of refs (`wantsPlayingRef`, `pendingRef`, `durationsRef`, demo timers…) to survive React lifecycles and avoid stale closures. In demo mode it drives the browser **Web Speech API** instead of fetching MP3s.
- **`useWebSocket`** — reconnecting WS with exponential backoff + 25s heartbeat; token in query param. Mostly dormant now (ask-a-doubt removed) but still sends `{type:'stop'}` on mode switch.
- **Design system:** warm-dark "notebook" aesthetic, Tailwind + CSS vars, framer-motion transitions, minimal hand-rolled UI primitives (`Button`, `Card`, `Dialog`, `Tabs`, `Toast`, `Skeleton`…). Marketing pages are elaborate (hero visuals, ambient backgrounds, knowledge-graph animation).
- **Position/state persistence:** last play position, bookmarks, and active source set are all in **localStorage** (per-doc namespaces), written directly from hooks with no server sync.

### Demo mode (a big, deliberate subsystem)
- **Why:** let recruiters/interviewers explore the *entire* product offline, with zero API cost and no failures.
- **How:** `DEMO_MODE` is read once at load from `localStorage['noorai.demoMode']` (set by the landing "Try the demo" button) or build-time `VITE_DEMO_MODE`. **Every** function in `lib/api.js` checks the flag and returns **static fixtures** from `src/demo/` instead of hitting the network, after sleeping a **realistic latency window** (`DEMO_LATENCY`, e.g. `overviewGen: 3600–5400ms`) so it never "feels instant fake." Auth is mocked (`demo@noorai.ai` / `demo123`, a client-minted JWT). Audio is browser Web Speech. Uploads/deletes are disabled (403 / no-op).
- **Impact:** a large parallel code path (fixtures for every feature) that must be kept in sync with the real API shapes.

---

## 12. Where it is NOT production-grade (the rebuild target list)

This is the section that matters most for the rebuild. Grouped by the user's stated concerns.

### Scalability & reliability
1. **Everything is JSON files on an ephemeral disk.** Podcasts, revision sets, preparation output, visuals, and all cached audio live only on Render's `/tmp` and are **not** mirrored — a redeploy or cold start wipes them and forces full regeneration (cost + multi-second latency). Only RAG chunks/meta survive (Postgres mirror). **→ Move all artifacts to a real object store (S3/R2) or the DB; make the disk a pure cache.**
2. **In-process singletons hold real state.** Per-doc chunk cache and six separate `_INFLIGHT` future-dicts (narration, podcast, visual, preparation, revision) live in process memory. They **don't survive restarts and don't work across multiple workers/instances** — so horizontal scaling would produce duplicate LLM/TTS calls and inconsistent dedup. Chunk cache has **no eviction** (unbounded growth). **→ External cache (Redis) + distributed locks; or make the service stateless.**
3. **Single-worker assumption.** WebSocket sessions, inflight locks, and caches all assume one process. There is no shared session/state layer, so you can't run >1 replica safely today.
4. **No background job queue.** Ingest (chunk+embed+upsert), podcast generation, and every revision/preparation generation run **inline in the request**. A slow PDF or a slow LLM call blocks the request; a mid-way failure returns a 5xx with no retry/resume. **→ Task queue (Celery/RQ/Arq) + job status polling or WS progress.**
5. **Ephemeral WS session state** — narration/podcast cursor is in memory; a dropped connection loses position server-side (frontend re-seeks from localStorage).

### Latency
6. **Synchronous LangChain in an async app.** All chains are sync, wrapped in `asyncio.to_thread` — bounded thread pool, no backpressure; fine for a few users, collapses under concurrency. **→ Native async LLM calls or a worker pool.**
7. **Cold-path penalties:** HF embedding cold-load (~20s first call), Render free dyno cold starts, and per-doc rehydration from Postgres on first access after a restart all add first-request latency.
8. **PDF extraction is blocking** (`pypdf` on the event-loop thread) for large files, inside the upload request.
9. **Q&A has no answer caching** — identical questions re-hit Groq every time; no semantic dedup.
10. **Chains send *all* chunks** for most revision/preparation features (`fetch_all()`), not a retrieved subset — larger prompts = higher latency + token cost, and it will break on large documents that exceed context limits.

### Cost
11. **No token/cost budgeting or accounting.** Only ElevenLabs has a crude in-process daily char cap (lost on restart). Groq/HF/Pinecone usage is unbounded per user. No per-user quotas, no cost tracking. **→ Per-user rate limits + usage metering + budget guards.**
12. **Regeneration waste** from #1 (lost caches) directly inflates LLM/TTS spend.
13. **Rate-limit handling is fragile** — upstream 429s are detected by **string-matching** the error message (`"429" in msg or "rate limit" in ...`), with **no exponential backoff or retry**; the user just gets an immediate 429.

### Observability & ops
14. **No metrics, tracing, or structured logging** — plain `logging` only. No request latency, LLM duration, or error-rate visibility; no correlation IDs across async tasks. **→ OpenTelemetry / structured logs / a metrics backend.**
15. **Silent best-effort failures** — Postgres mirror writes, Pinecone deletes, and disk cleanup all swallow exceptions and log, so you can get **orphaned vectors** (Pinecone delete fails but disk cleaned) or **un-hydratable docs** (mirror write failed) with no alert.
16. **No pagination** on `GET /api/documents` and `GET /api/visuals/{doc_id}` — returns everything.
17. **Deploy footguns:** `JWT_SECRET` via `generateValue` can rotate on redeploy and invalidate all sessions; `STORAGE_DIR=/tmp` on Render free is ephemeral by design.

### Correctness / product debt
18. **Stale README** (claims Whisper + FAISS; neither is used).
19. **Dead code from the pivot** — WebSocket "ask a doubt" FSM messages, unused `serverState`/`wsStatus`/`sendJson` props threaded into `NarrationView`/`PodcastPlayback`, and the largely-dormant `/ws` control channel.
20. **Two names** (EchoVerse app title / echoverse.* localStorage keys vs. NoorAI branding) — inconsistent identifiers throughout.
21. **`sessions`/`messages` tables** exist but aren't meaningfully used — study history isn't persisted.
22. **Frontend:** no `prefers-reduced-motion`, sparse ARIA, generic error toasts with no retry UI, no service worker/offline, multi-tab localStorage has no conflict resolution.

---

## 13. Key constants & config (quick reference)

| Area | Setting | Value |
|---|---|---|
| Chunking | narration / rag target / overlap | 600 / 800 / 120 chars |
| Embeddings | model / dim / batch / timeout | MiniLM-L6-v2 / 384 / 64 / 60s |
| Pinecone | metric / namespace / upsert batch | cosine / per-doc / 96 |
| Retrieval | default top-k | 4 |
| LLM | model | `llama-3.3-70b-versatile` |
| Overview graph | max attempts | 2 |
| Podcast | max turns / context cap | 32 / ~12k chars |
| Visual | min/max chars | 30 / 6000 |
| Preparation | max docs/request | 10 |
| TTS | primary/fallback / daily cap | ElevenLabs `eleven_turbo_v2_5` / Edge `en-US-AriaNeural` / 50k chars |
| Voices | host / guest | Rachel `21m00Tcm4TlvDq8ikWAM` / Adam `pNInz6obpgDQGcFmaJgB` |
| Auth | algo / TTL | HS256 / 60 min |
| WebSocket | idle / rate cap / frame cap | 180s / 100 msg/s / 4 KiB |
| Session | max duration | 30 min |

**Required env (backend):** `GROQ_API_KEY`, `DATABASE_URL` (`postgresql+asyncpg://…?ssl=require`), `HUGGINGFACE_API_TOKEN`, `PINECONE_API_KEY` (+ index/cloud/region), `JWT_SECRET`, `CORS_ORIGINS`, `FRONTEND_URL`, `STORAGE_DIR`. Optional: `ELEVENLABS_API_KEY` (blank → free Edge-TTS).
**Frontend env:** `VITE_API_URL`, `VITE_WS_URL`, `VITE_DEMO_MODE`.

---

## 14. Suggested first moves for the production rebuild

Not prescriptive — a starting order derived from §12, highest-leverage first:

1. **Durable storage:** move all artifacts + cached audio off ephemeral disk to object storage (S3/R2) or DB; treat disk as cache only. Kills #1, #12, most regeneration cost.
2. **Async job queue** for ingest + all generation, with job-status polling / WS progress. Kills #4, #6, #8; unblocks horizontal scale.
3. **Shared state layer (Redis):** distributed inflight locks + caches + rate limits, so the app becomes stateless and multi-replica safe. Kills #2, #3, #11.
4. **Cost/quota controls:** per-user rate limits + usage metering + real backoff/retry with a proper client (not string-matching). Kills #11, #13.
5. **Observability:** structured logs + metrics + tracing + alerting on the currently-silent failure paths. Kills #14, #15.
6. **Retrieval discipline:** stop sending all chunks; use retrieval + summarization for large docs so cost/latency don't grow with document size, and long docs stop breaking. Kills #10.
7. **Cleanup:** delete dead barge-in/WS code, fix the README, unify the EchoVerse/NoorAI naming, add pagination. Kills #16, #18, #19, #20.

---

*Generated from a full read of the current codebase (backend `app/`, frontend `src/`, deploy config). If any detail here conflicts with the README, trust this document — the README predates the NoorAI pivot.*
