"""Bidirectional WebSocket: /ws/audio.

Wire format:
  Inbound JSON (text frames):
    {"type": "start_narration", "doc_id": "..."}
    {"type": "stop"}
    {"type": "resume"}
  Inbound binary frames: int16 LE PCM, 16kHz mono, any chunk size.

  Outbound JSON:
    {"type": "state", "value": "narrating|listening|thinking|speaking|idle", "cursor": int}
    {"type": "transcript", "role": "user|narrator|assistant", "text": "...", "chunk_idx"?: int}
    {"type": "narration_cursor", "chunk_idx": int}
    {"type": "narration_done"}
    {"type": "flush_audio"}                  # client should drop its playback queue
    {"type": "error", "message": "..."}
  Outbound binary frames: MP3 audio chunks for playback.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.session_service import Session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/audio")
async def ws_audio(ws: WebSocket) -> None:
    await ws.accept()

    async def send_json(payload: dict) -> None:
        await ws.send_text(json.dumps(payload))

    async def send_bytes(data: bytes) -> None:
        await ws.send_bytes(data)

    session = Session(send_json=send_json, send_bytes=send_bytes)
    await send_json({"type": "ready"})

    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break

            if "bytes" in msg and msg["bytes"] is not None:
                session.feed_audio(msg["bytes"])
                continue

            if "text" in msg and msg["text"] is not None:
                try:
                    payload = json.loads(msg["text"])
                except json.JSONDecodeError:
                    await send_json({"type": "error", "message": "invalid json"})
                    continue

                kind = payload.get("type")
                if kind == "start_narration":
                    doc_id = payload.get("doc_id")
                    if not doc_id:
                        await send_json({"type": "error", "message": "missing doc_id"})
                        continue
                    await session.start_narration(doc_id)
                elif kind == "stop":
                    await session.stop()
                elif kind == "resume":
                    await session.resume()
                elif kind == "ping":
                    await send_json({"type": "pong"})
                else:
                    await send_json({"type": "error", "message": f"unknown type: {kind}"})

    except WebSocketDisconnect:
        logger.info("client disconnected")
    except Exception:
        logger.exception("ws_audio crashed")
    finally:
        try:
            await session.stop()
        except Exception:
            pass
