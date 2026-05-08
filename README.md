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

## One-time setup

### Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env
# Edit .env with your API keys + DATABASE_URL

# Pre-download the Whisper model (~140MB, runs once)
python -m backend.scripts.download_whisper

# Apply DB schema
alembic -c backend/alembic.ini upgrade head
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

**Terminal 1 — backend** (run from project root, since modules use `backend.` prefix):
```powershell
cd C:\Users\hashi\Desktop\eco
.\backend\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — frontend:**
```powershell
cd C:\Users\hashi\Desktop\eco\frontend
npm run dev
```

Open http://localhost:5173, click **Start**, allow mic permission. Paste a few paragraphs of notes, hit **Start narration**, then speak mid-narration to interrupt and ask a question.

---

## Project layout

```
eco/
├── PLAN.md                    architecture + build plan
├── README.md                  this file
├── backend/
│   ├── main.py                FastAPI app
│   ├── routes/                upload, llm, tts (REST), audio (WebSocket)
│   ├── services/              whisper, rag, groq, tts, session FSM
│   ├── utils/                 audio_utils, vad, chunker
│   ├── models/                SQLAlchemy models
│   ├── db/                    engine, alembic migrations
│   ├── config/                pydantic-settings
│   └── scripts/               download_whisper.py
└── frontend/
    ├── public/pcm-capture.js  AudioWorklet (16kHz int16 PCM downsampler)
    └── src/
        ├── pages/             Home, Session
        ├── components/        UploadPanel, MicButton, WaveformViz, TranscriptLog, StatusPill
        ├── hooks/             useWebSocket, useMicStream, useAudioPlayer
        └── lib/               api.js
```

---

## Verification checklist

- [ ] `python -m backend.scripts.download_whisper` finishes and prints model path
- [ ] `GET http://localhost:8000/` returns `{"status":"ok"}`
- [ ] `npm run dev` opens with no console errors
- [ ] Paste a 500-word note → narration starts within ~2s
- [ ] Speak mid-narration → narration cuts within ~500ms, status flips `narrating → listening → thinking → speaking`, answer plays, narration resumes
- [ ] Force ElevenLabs failure (rotate key to invalid) → Google TTS takes over silently

---

## Deployment

- **Frontend → Vercel:** point at the `frontend/` directory; set `VITE_API_BASE` and `VITE_WS_URL` to your backend's https/wss URL.
- **Backend → Render or Fly.io:** deploy `backend/Dockerfile` (it bakes in ffmpeg + pre-downloads the Whisper model). Set all `.env` vars in the dashboard. Mount a persistent volume at `/data/storage` so FAISS indexes survive restarts.

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
