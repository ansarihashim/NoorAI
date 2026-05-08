# EchoVerse — Build Plan

> Real-Time Bidirectional AI Voice Agent
> STT · LLM · TTS · RAG · WebSockets

---

## 1. Project Overview

**EchoVerse** is a real-time conversational AI voice agent that simulates a "group study with AI" — a study partner that reads your notes aloud and answers your doubts mid-stream.

### What it does
- User uploads notes / pastes any text content.
- System narrates the content in audio form.
- User can interrupt anytime by speaking.
- System answers questions using context retrieved from the user's own notes (RAG).
- Narration auto-resumes intelligently from where it stopped after the Q&A.

### What this is NOT
- **Not** an audiobook generator.
- **Not** a one-way TTS tool.
- It is a **bidirectional, interruptible, context-aware voice agent**.

### Goals
- Real-time conversational experience (<3s end-to-end latency).
- Interruptible narration with graceful resumption.
- Context-aware answers via RAG over user-uploaded content.
- Production-ready modular architecture, fully deployable with a public URL.

---

## 2. Architecture

```
[ User Mic ]
     │
     ▼
[ React Frontend  (Vite + JS + Tailwind + WebRTC/AudioWorklet) ]
     │   binary PCM 16kHz mono  +  JSON control frames
     ▼
[ FastAPI Backend  ──  /ws/audio  WebSocket ]
     │
     ├──► Whisper STT (faster-whisper base.en, CPU int8)   ── speech → text
     ├──► RAG (FAISS + MiniLM embeddings)                   ── retrieve context
     ├──► Groq LLM (llama-3.3-70b-versatile, streaming)     ── generate answer
     ├──► TTS  (ElevenLabs streaming  ──fallback──►  Google TTS)
     └──► PostgreSQL (Neon) — sessions, transcripts, documents
                  ▲
                  │  audio chunks + state events
                  ▼
[ Frontend Audio Player  (MediaSource queue, interruptible) ]
```

### Two flows running through the same WebSocket

**Narration Flow**
1. User uploads text → backend chunks it.
2. LLM optionally refines text (clarity / pacing).
3. TTS generates audio per chunk.
4. Audio streamed to frontend.
5. Frontend plays via queued MediaSource.

**Interrupt Flow**
1. User speaks mid-narration.
2. Mic audio sent in real-time 20ms PCM frames.
3. VAD (webrtcvad) detects sustained speech → server cancels current TTS task.
4. On silence (~700ms), Whisper transcribes the utterance.
5. RAG retrieves top-k chunks from FAISS.
6. Groq LLM generates the answer with retrieved context.
7. TTS speaks the answer.
8. Narration auto-resumes from the saved cursor.

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + Vite + JavaScript** (no TypeScript) + TailwindCSS | Per requirement; Vite for fast HMR |
| Real-time transport | WebSocket + AudioWorklet (WebRTC-style mic capture) | Simpler than full WebRTC, sufficient for our needs |
| Backend | **FastAPI** + Uvicorn + native `websockets` | Spec |
| STT | **faster-whisper `base.en`** (CTranslate2, int8, CPU) | Zero cost, 2–4× faster than openai-whisper on CPU |
| LLM | **Groq** SDK, model `llama-3.3-70b-versatile` (streaming) | Lowest latency among providers |
| TTS primary | **ElevenLabs** streaming (`eleven_turbo_v2_5`) | Best voice quality |
| TTS fallback | **Google Cloud TTS** | Reliability + cost control |
| Vector DB | **FAISS** (local `.index` file) | Fast, no cloud dependency |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (~80MB) | Small, fast on CPU |
| VAD | `webrtcvad` (mode 2) | Cheap silence/speech detection |
| Database | **PostgreSQL** on Neon (free tier) | Spec |
| ORM | **SQLAlchemy 2.x async** + Alembic | FastAPI standard |
| Deployment | Frontend → Vercel; Backend → Render or Fly.io | Spec |

---

## 4. Prerequisites & System Setup (Windows-first)

### 4.1 System dependencies

```powershell
# Python 3.11 (Whisper compat)
winget install Python.Python.3.11

# Node 20+
winget install OpenJS.NodeJS.LTS

# Git
winget install Git.Git

# ffmpeg — REQUIRED by Whisper for audio decoding
winget install Gyan.FFmpeg
```

After install, open a fresh PowerShell and verify:

```powershell
python --version    # 3.11.x
node --version      # v20.x
ffmpeg -version     # must print version info
```

> If `ffmpeg` is not on PATH, Whisper will fail silently. Fix PATH before continuing.

### 4.2 Database

Create a free Neon project at https://neon.tech → copy the connection string → use as `DATABASE_URL` in `backend/.env`.

### 4.3 API keys to obtain

| Service | Where | Env var |
|---|---|---|
| Groq | https://console.groq.com/keys | `GROQ_API_KEY` |
| ElevenLabs | https://elevenlabs.io/app/settings/api-keys | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` |
| Google Cloud TTS | GCP Console → enable Text-to-Speech API → service-account JSON or API key | `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_TTS_API_KEY` |
| Neon Postgres | Neon dashboard → connection string | `DATABASE_URL` |

---

## 5. Whisper Model Download

We use **faster-whisper** (`base.en`, ~140MB, int8, CPU) — better accuracy than tiny, fits the <3s latency target on CPU.

### 5.1 Pre-download script

Create `backend/scripts/download_whisper.py`:

```python
"""Pre-download Whisper model so the first WS request isn't slow."""
from faster_whisper import WhisperModel

print("Downloading faster-whisper base.en (int8) ...")
model = WhisperModel("base.en", device="cpu", compute_type="int8")
print("Done. Model is cached under ~/.cache/huggingface/")
```

Run it during project setup:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts/download_whisper.py
```

The model is cached at `%USERPROFILE%\.cache\huggingface\` and reused across runs.

### 5.2 Embedding model (auto-downloads on first use)

`sentence-transformers/all-MiniLM-L6-v2` (~80MB) auto-downloads when `rag_service.py` first imports it. To pre-download:

```python
from sentence_transformers import SentenceTransformer
SentenceTransformer("all-MiniLM-L6-v2")
```

### 5.3 Production note

In the backend Docker image, run `python scripts/download_whisper.py` during the build step so the model ships baked into the image — otherwise the first prod request takes 30+ seconds.

---

## 6. Repository Layout

```
eco/
├── PLAN.md                       ← this file
├── README.md                     ← short user-facing readme
├── .gitignore
├── docker-compose.yml            ← optional: local Postgres for dev
│
├── backend/
│   ├── main.py                   ← FastAPI app, CORS, WS routes mount
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── .env.example
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── audio.py              ← /ws/audio bidirectional WebSocket
│   │   ├── llm.py                ← POST /api/llm/answer (debug only)
│   │   ├── tts.py                ← POST /api/tts/synthesize (debug only)
│   │   └── upload.py             ← POST /api/upload (text/pdf → chunks → FAISS)
│   ├── services/
│   │   ├── whisper_service.py    ← faster-whisper singleton
│   │   ├── rag_service.py        ← FAISS index + MiniLM embeddings
│   │   ├── groq_service.py       ← Groq streaming chat
│   │   ├── tts_service.py        ← ElevenLabs primary + Google fallback
│   │   └── session_service.py    ← per-session state machine
│   ├── utils/
│   │   ├── audio_utils.py        ← PCM/wav, resample to 16kHz mono
│   │   ├── vad.py                ← webrtcvad wrapper, silence FSM
│   │   └── chunker.py            ← text → narration-sized chunks
│   ├── models/
│   │   ├── user.py
│   │   └── session.py            ← Session, Document, Message
│   ├── config/
│   │   └── settings.py           ← pydantic-settings reads .env
│   ├── db/
│   │   ├── base.py               ← async engine + sessionmaker
│   │   └── migrations/           ← alembic versions/
│   └── scripts/
│       └── download_whisper.py
│
└── frontend/
    ├── package.json              ← Vite + React 18 (JS, no TS)
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env.example              ← VITE_API_BASE, VITE_WS_URL
    └── src/
        ├── main.jsx              ← React root
        ├── App.jsx               ← routes + layout
        ├── index.css             ← Tailwind directives
        ├── pages/
        │   ├── Home.jsx          ← upload + start session
        │   └── Session.jsx       ← active voice session UI
        ├── components/
        │   ├── UploadPanel.jsx
        │   ├── NarrationPlayer.jsx
        │   ├── MicButton.jsx
        │   ├── WaveformViz.jsx
        │   ├── TranscriptLog.jsx
        │   └── StatusPill.jsx    ← idle / narrating / listening / thinking / speaking
        ├── hooks/
        │   ├── useWebSocket.js   ← reconnect, JSON + binary frames
        │   ├── useMicStream.js   ← getUserMedia + AudioWorklet PCM
        │   └── useAudioPlayer.js ← MediaSource queue, interruptible
        ├── lib/
        │   ├── api.js            ← REST client
        │   └── audio.js          ← PCM helpers
        └── worklets/
            └── pcm-capture.js    ← AudioWorklet: 16kHz mono PCM
```

---

## 7. Phased Build Plan

Each phase has a clear "Done when" gate. Don't move on until the gate passes.

### Phase 0 — Bootstrap (≈ 30 min)

```powershell
# At C:\Users\hashi\Desktop\eco
git init

# Backend skeleton
mkdir backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi "uvicorn[standard]" websockets pydantic pydantic-settings
pip freeze > requirements.txt
# create main.py with a single GET / returning {"status":"ok"}

# Frontend skeleton
cd ..
npm create vite@latest frontend -- --template react      # NOT react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Add `@tailwind base; @tailwind components; @tailwind utilities;` to `src/index.css`.

**Done when:**
- `uvicorn main:app --reload` returns `{"status":"ok"}` on http://localhost:8000.
- `npm run dev` shows the Vite welcome page on http://localhost:5173.

### Phase 1 — Whisper + VAD (≈ 2–3 hr)

```powershell
pip install faster-whisper webrtcvad numpy soundfile
python scripts/download_whisper.py
```

Files to create:
- `services/whisper_service.py` — singleton, `transcribe(pcm_16k_mono: bytes) -> str`.
- `utils/vad.py` — `webrtcvad` mode 2, 30ms frames, 700ms trailing silence triggers an "utterance complete" event.
- `utils/audio_utils.py` — PCM ↔ wav helpers, resample to 16kHz mono.

**Done when:** a standalone test script feeds a sample wav and prints the transcript in <2s.

### Phase 2 — RAG + Groq + TTS (≈ 3–4 hr)

```powershell
pip install groq elevenlabs google-cloud-texttospeech sentence-transformers faiss-cpu pypdf
```

Files:
- `services/rag_service.py` — build FAISS index from text chunks, `retrieve(query, k=4)`.
- `services/groq_service.py` — streaming chat with system prompt for "study buddy"; takes `(retrieved_chunks, history, user_question)`.
- `services/tts_service.py` — `async def synthesize_stream(text) -> AsyncIterator[bytes]`. Try ElevenLabs streaming first; on 429/402/network error fall back to Google TTS (whole-clip).
- `routes/upload.py` — accept text or PDF, chunk via `utils/chunker.py`, embed, persist FAISS index per `doc_id`.
- `routes/llm.py`, `routes/tts.py` — REST debug endpoints.

**Done when:** `POST /api/llm/answer {doc_id, question}` streams back audio bytes that play correctly.

### Phase 3 — WebSocket session orchestration (≈ 4–5 hr)

This is the heart of the project.

`routes/audio.py` exposes a single `/ws/audio` endpoint handling:

**Inbound JSON control frames:**
- `{type:"start_narration", doc_id}`
- `{type:"stop"}`
- `{type:"resume"}`

**Inbound binary frames:** 20ms PCM 16kHz mono chunks from mic.

**Outbound JSON:**
- `{type:"state", value:"narrating|listening|thinking|speaking"}`
- `{type:"transcript", text, role:"user"|"assistant"}`
- `{type:"narration_cursor", chunk_idx}`

**Outbound binary:** TTS audio chunks (mp3 or pcm).

`services/session_service.py` is a finite state machine:

```
IDLE
 │  start_narration
 ▼
NARRATING ──── VAD detects user speech ────► INTERRUPTED
 ▲                                             │
 │                                             ▼  silence ≥ 700ms
 │                                          THINKING (Whisper → RAG → Groq)
 │                                             │
 │                                             ▼
 │                                          SPEAKING_ANSWER (TTS stream)
 │                                             │  done
 └───────────── resume from cursor ────────────┘
```

Implementation notes:
- Each session owns one asyncio Task for "current playback". Interruption = `task.cancel()` plus a flush message to the client that empties its audio queue.
- Narration cursor = `(chunk_idx, byte_offset)` saved every emitted chunk; resume re-renders chunks `chunk_idx+1..end`.
- Mic stream: VAD on the server, not the client. Only run Whisper on segments that VAD marked as speech.

**Done when:** an integration test client (or browser) can start narration, interrupt by sending mic audio, receive an answer, and observe narration resuming from the same place.

### Phase 4 — Frontend wiring (≈ 4–5 hr)

Files:
- `worklets/pcm-capture.js` — AudioWorkletProcessor that downsamples to 16kHz mono Float32, converts to Int16 PCM, posts to main thread.
- `hooks/useMicStream.js` — `getUserMedia({audio:{echoCancellation:true, noiseSuppression:true}})` → AudioContext → register worklet → forward Int16 buffers to caller.
- `hooks/useWebSocket.js` — connect on mount, expose `send(json)`, `sendBinary(buf)`, exponential-backoff reconnect.
- `hooks/useAudioPlayer.js` — queue of ArrayBuffers fed to `MediaSource` SourceBuffer (audio/mpeg) with `interrupt()` that flushes the buffer.
- `pages/Home.jsx` — paste-text textarea + drop-zone for `.txt` / `.pdf` → POST `/api/upload` → navigate to `/session/:docId`.
- `pages/Session.jsx` — top: StatusPill + WaveformViz + MicButton; middle: TranscriptLog (scrollback of Q&A); bottom: NarrationPlayer progress.
- Tailwind theme: dark navy background with purple/cyan accent palette to match the spec PDF aesthetic.

**Done when:** end-to-end browser flow works — upload note, hear narration, speak mid-stream, hear answer, narration resumes.

### Phase 5 — Persistence, quotas, deploy (≈ 3–4 hr)

- Alembic init + first migration: `users`, `sessions`, `documents`, `messages`.
- Persist transcripts and document metadata to Postgres on every state transition.
- Quota counter in `settings.py`: e.g., `SESSION_MAX_MINUTES=30`, `ELEVENLABS_CHARS_PER_DAY=50000`. Refuse to start narration if exceeded.
- `Dockerfile` for backend — must `apt-get install -y ffmpeg` and run `download_whisper.py` during build.
- Deploy frontend to Vercel; set `VITE_API_BASE` and `VITE_WS_URL` to backend URL.
- Deploy backend to Render or Fly.io; set all env vars from `.env.example`.

**Done when:** a public URL works on a fresh laptop with mic permission.

---

## 8. Environment Variables

### `backend/.env.example`

```env
# LLM
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# TTS — primary
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL=eleven_turbo_v2_5

# TTS — fallback (use ONE of the following)
GOOGLE_APPLICATION_CREDENTIALS=./google-tts-sa.json
# GOOGLE_TTS_API_KEY=...

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname

# Whisper
WHISPER_MODEL=base.en
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8

# App
APP_ENV=dev
CORS_ORIGINS=http://localhost:5173
SESSION_MAX_MINUTES=30
```

### `frontend/.env.example`

```env
VITE_API_BASE=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/audio
```

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Whisper latency on slow CPU | `faster-whisper` int8 on `base.en`; only transcribe VAD-detected speech segments, never continuous audio |
| ElevenLabs credit exhaustion | Auto-fallback to Google TTS on 429/402/network errors; per-session char quota; cache narration audio by chunk hash |
| WebRTC complexity | Use plain WebSocket + AudioWorklet (PCM); upgrade to true WebRTC peer connection only if echo cancellation needs it |
| Audio sync / stale-buffer issues | Single asyncio Task owns playback per session; cancellation flushes both server queue and client MediaSource buffer |
| ffmpeg missing in production | Install in Dockerfile: `RUN apt-get update && apt-get install -y ffmpeg` |
| First-call Whisper cold start in prod | Run `scripts/download_whisper.py` in Docker build, not at runtime |
| Browser autoplay policy blocks audio | First user interaction (clicking "Start") unlocks AudioContext; document this in UI |
| WebSocket disconnects on flaky networks | Exponential-backoff reconnect in `useWebSocket.js`; server-side session state survives a brief disconnect |

---

## 10. End-to-End Verification Checklist

- [ ] `python scripts/download_whisper.py` succeeds and prints model path.
- [ ] `uvicorn backend.main:app` starts; `GET /` returns `{"status":"ok"}`.
- [ ] `npm run dev` serves the frontend on :5173 with no console errors.
- [ ] Upload a 500-word text → narration starts within 2s, audio plays smoothly.
- [ ] Speak "what does this mean?" mid-narration → narration cuts within 500ms, status flips `narrating → listening → thinking → speaking`, answer plays, narration resumes from the same sentence.
- [ ] Force ElevenLabs failure (rotate key to invalid) → Google TTS takes over silently, no user-visible error.
- [ ] Reload `/session/:docId` → previous transcript loads from Postgres.
- [ ] Deploy to Vercel + Render → public URL works on a phone over 4G.
- [ ] Latency: end-to-end Q&A round-trip ≤ 3s on a typical CPU laptop.

---

## 11. Out of Scope (Deferred)

Explicitly listed so we don't drift:
- Multi-speaker voices.
- Emotion detection in voice.
- Mobile native app (iOS / Android).
- Subscription billing model.
- True WebRTC peer-to-peer connection (WebSocket + AudioWorklet is sufficient for our needs).
- Real-time streaming TTS for the fallback path (Google TTS is whole-clip in our impl).

These are listed as "Future Enhancements" in the spec PDF and may be picked up after the v1 deployment is stable.

---

## 12. Final Deliverable

- Live deployed URL (Vercel + Render/Fly.io).
- Working voice interaction end-to-end.
- Stable narration with reliable interruption + resumption.
- Clean, polished dark-themed UI.
- Documented setup such that any developer can clone the repo and run it locally in under 15 minutes.
