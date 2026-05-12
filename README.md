# EchoVerse

> Real-Time Bidirectional AI Voice Agent — your "group study with AI" partner.
> Upload notes → it narrates aloud → interrupt anytime to ask questions → narration auto-resumes.

**Stack:** React (JS) + Vite + Tailwind · FastAPI + WebSockets · faster-whisper (local CPU) · Groq · ElevenLabs (+ Google TTS fallback) · FAISS · PostgreSQL.

See [PLAN.md](./PLAN.md) for the architecture, phased build plan, and design rationale.

---

## Prerequisites

```powershell
winget install Python.Python.3.11
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg            # REQUIRED by Whisper
```

Verify in a **fresh** PowerShell:
```powershell
python --version    # 3.11.x
node --version      # v20.x
ffmpeg -version
```

You also need API keys (free tiers all work):
- **Groq** — https://console.groq.com/keys
- **ElevenLabs** — https://elevenlabs.io/app/settings/api-keys
- **Google Cloud TTS** (fallback) — enable Text-to-Speech API → service-account JSON or API key
- **Postgres** — https://neon.tech free tier

---

## One-time local setup

### Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env
# Edit .env with your API keys + DATABASE_URL

# Pre-download the Whisper model (~140MB, runs once)
python -m app.scripts.download_whisper

# Apply DB schema
alembic -c alembic.ini upgrade head
```

### Frontend
```powershell
cd ..\frontend
npm install
copy .env.example .env
# Defaults point to http://localhost:8000 — change only if you moved the backend
```

---

## Run dev servers (two terminals)

**Terminal 1 — backend** (run from `backend/`, the `app.` package is at the root):
```powershell
cd C:\Users\hashi\Desktop\eco\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend:**
```powershell
cd C:\Users\hashi\Desktop\eco\frontend
npm run dev
```

Open http://localhost:5173, sign up, upload a PDF, then start narration or ask a doubt.

---

## Project layout

```
eco/
├── README.md
├── .gitignore
│
├── frontend/                       Vercel target
│   ├── public/pcm-capture.js       AudioWorklet (16 kHz int16 PCM downsampler)
│   ├── src/
│   │   ├── components/             Workspace, preparation, revision, session, marketing, ui
│   │   ├── hooks/                  useWebSocket, useMicStream, useAudioPlayer, useAudio…
│   │   ├── lib/                    api.js, auth.jsx, citations.jsx, sanitize.js, sound.jsx
│   │   └── pages/                  Landing, Login, Signup, Library, Settings, Session, NotFound
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vercel.json                 SPA rewrite + cache headers + security headers
│   └── .env.example                VITE_API_URL + VITE_WS_URL
│
└── backend/                        Render target
    ├── app/                        the Python package (`app.main:app`)
    │   ├── main.py                 FastAPI app, CORS, security headers, routers
    │   ├── core/                   pydantic-settings
    │   ├── api/                    REST routers (auth, upload, documents, llm, tts,
    │   │                              narration, podcast, visuals, preparation,
    │   │                              revision, voices)
    │   ├── websocket/audio.py      /ws/audio handler with JWT-in-query + origin check
    │   ├── auth/                   JWT + password + dependency helpers
    │   ├── services/               groq, tts, whisper, narration, podcast, visual,
    │   │                              session FSM, preparation, revision
    │   ├── rag/                    FAISS service, retriever, chunker, chains,
    │   │                              graphs, prompts, schemas
    │   ├── models/                 User, Document, Session, Message
    │   ├── db/                     async engine, alembic env, 3 migrations
    │   ├── utils/                  vad, rate_limit, security_input, security_middleware,
    │   │                              audio_utils, voices_catalog
    │   └── scripts/download_whisper.py
    ├── alembic.ini
    ├── requirements.txt
    ├── runtime.txt                 Python 3.11.9 pin for Render
    ├── render.yaml                 Render Blueprint (build + start + env vars)
    ├── Dockerfile                  optional, for local Docker / non-Render hosts
    └── .env.example
```

---

## Production deployment

### Prerequisites (free tier on every line)

| Component | Provider | Notes |
|---|---|---|
| Frontend | **Vercel** | free, auto-deploy on push |
| Backend  | **Render** | free Web Service plan (512 MB RAM, spins down after 15 min idle, no disk) |
| Database | **Neon**   | free Postgres, 0.5 GB |
| LLM      | **Groq**   | free tier, rate-limited |
| TTS      | **Edge-TTS** (Microsoft) | free, no API key — used automatically when ElevenLabs/Google envs are blank |

### Deploy the backend (Render)

1. Push the repo to GitHub.
2. Render Dashboard → New → Blueprint → connect this repo. Render reads `backend/render.yaml`.
3. Fill in the `sync: false` env vars in the prompt:
   - `GROQ_API_KEY` — from console.groq.com
   - `DATABASE_URL` — your Neon string in `postgresql+asyncpg://user:pass@host/db?ssl=require` form
   - `CORS_ORIGINS` — your Vercel URL (set once it's live; can revisit)
   - `FRONTEND_URL` — same Vercel URL
4. Click Create. Build takes 6–10 minutes (Whisper + sentence-transformers pre-download + alembic upgrade).
5. Once green: `curl https://<service>.onrender.com/healthz` → `{"ok":true}`.

The blueprint already sets `WHISPER_MODEL=tiny.en` and `STORAGE_DIR=/tmp/storage` for the 512 MB free tier. FAISS indices and chunks are mirrored to the `rag_indices` table in Postgres on every upload, so uploaded documents survive the every-15-minute disk wipe.

### Deploy the frontend (Vercel)

1. Vercel Dashboard → New Project → import the same GitHub repo.
2. Settings:
   - Root Directory: `frontend`
   - Framework: Vite (auto-detected)
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Environment Variables (Production):
   - `VITE_API_URL` = `https://<service>.onrender.com`
   - `VITE_WS_URL`  = `wss://<service>.onrender.com/ws/audio`
4. Deploy. Then go back to Render and set `CORS_ORIGINS` to the Vercel URL → Manual Deploy → Clear build cache & deploy.

### Verification (post-deploy)

1. `curl https://<service>.onrender.com/healthz` → `{"ok":true}`
2. Open the Vercel URL → sign up → upload a 1-3 page PDF
3. Wait 16 minutes (forces a Render cold start) → reopen the doc → Overview still generates → confirms FAISS-in-Postgres hydration is working
4. Click Ask-a-doubt → speak → audio reply plays → confirms wss:// upgrade through Render's edge + mic worklet + Whisper

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Whisper hangs / silent failure | `ffmpeg` not on PATH |
| `cannot import name 'AsyncGroq'` | old `groq` package — `pip install -U groq` |
| MediaSource won't open in browser | needs HTTPS in production (or `localhost` in dev) |
| "no audio after Start" | autoplay blocked — make sure Start is triggered by a click |
| Whisper download fails | first run needs internet; after that the model is cached |

---

## License

MIT (or your choice — see PLAN.md §11 for what's out of scope).
