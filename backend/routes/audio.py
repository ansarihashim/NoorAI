"""Bidirectional WebSocket: /ws/audio.

Wire format:
  Inbound JSON (text frames):
    {"type": "start_narration", "doc_id": "..."}
    {"type": "stop"}
    {"type": "resume"}
    {"type": "ping"}
  Inbound binary frames: int16 LE PCM, 16kHz mono, any chunk size.

  Outbound JSON:
    {"type": "ready"}
    {"type": "pong"}
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
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.session_service import Session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/audio")
async def ws_audio(ws: WebSocket) -> None:
    conn_id = uuid.uuid4().hex[:8]
    client = f"{ws.client.host}:{ws.client.port}" if ws.client else "?"
    started = time.monotonic()
    text_msgs = 0
    bytes_frames = 0
    bytes_total = 0

    logger.info("ws[%s] connect from %s", conn_id, client)

    try:
        await ws.accept()
    except Exception:
        logger.exception("ws[%s] accept failed", conn_id)
        return

    async def send_json(payload: dict) -> None:
        await ws.send_text(json.dumps(payload))

    async def send_bytes(data: bytes) -> None:
        await ws.send_bytes(data)

    session = Session(send_json=send_json, send_bytes=send_bytes)
    try:
        await send_json({"type": "ready"})
    except Exception:
        logger.exception("ws[%s] failed to send ready frame", conn_id)
        return

    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break

            if "bytes" in msg and msg["bytes"] is not None:
                payload = msg["bytes"]
                bytes_frames += 1
                bytes_total += len(payload)
                session.feed_audio(payload)
                continue

            if "text" in msg and msg["text"] is not None:
                text_msgs += 1
                try:
                    obj = json.loads(msg["text"])
                except json.JSONDecodeError:
                    logger.warning("ws[%s] invalid json: %r", conn_id, msg["text"][:200])
                    await send_json({"type": "error", "message": "invalid json"})
                    continue

                kind = obj.get("type")
                logger.debug("ws[%s] recv text type=%s", conn_id, kind)

                if kind == "start_narration":
                    doc_id = obj.get("doc_id")
                    if not doc_id:
                        await send_json({"type": "error", "message": "missing doc_id"})
                        continue
                    try:
                        await session.start_narration(doc_id)
                    except Exception as exc:
                        logger.exception("ws[%s] start_narration failed", conn_id)
                        await send_json({"type": "error", "message": f"start_narration failed: {exc}"})
                elif kind == "stop":
                    try:
                        await session.stop()
                    except Exception:
                        logger.exception("ws[%s] stop failed", conn_id)
                elif kind == "resume":
                    try:
                        await session.resume()
                    except Exception as exc:
                        logger.exception("ws[%s] resume failed", conn_id)
                        await send_json({"type": "error", "message": f"resume failed: {exc}"})
                elif kind == "ping":
                    await send_json({"type": "pong"})
                else:
                    logger.warning("ws[%s] unknown type=%r", conn_id, kind)
                    await send_json({"type": "error", "message": f"unknown type: {kind}"})

    except WebSocketDisconnect as exc:
        logger.info("ws[%s] disconnect code=%s", conn_id, getattr(exc, "code", "?"))
    except Exception:
        logger.exception("ws[%s] handler crashed", conn_id)
    finally:
        try:
            await session.stop()
        except Exception:
            logger.exception("ws[%s] session.stop failed during cleanup", conn_id)

        elapsed = time.monotonic() - started
        logger.info(
            "ws[%s] closed after %.2fs text_msgs=%d audio_frames=%d audio_bytes=%d",
            conn_id, elapsed, text_msgs, bytes_frames, bytes_total,
        )
