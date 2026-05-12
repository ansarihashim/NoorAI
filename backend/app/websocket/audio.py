"""Server-push WebSocket: /ws/audio.

Auth: token must be passed as `?token=<JWT>` in the query string. The browser
WebSocket API cannot set custom headers, so query-string auth is pragmatic.
Connections without a valid token are closed with code 1008 (policy violation).

Direction:
  The voice barge-in feature was removed — the socket is now server-push only.
  Inbound mic audio (binary frames) is no longer handled at all; clients that
  send binary frames have them dropped silently.

Wire format:
  Inbound JSON (text frames):
    {"type": "start_narration", "doc_id": "..."}
    {"type": "start_podcast",   "doc_id": "..."}
    {"type": "stop"}
    {"type": "resume"}
    {"type": "ping"}

  Outbound JSON:
    {"type": "ready"}
    {"type": "pong"}
    {"type": "state", "value": "narrating|idle|podcast_generating|podcast_playing", "cursor": int}
    {"type": "transcript", "role": "narrator", "text": "...", "chunk_idx"?: int}
    {"type": "narration_cursor", "chunk_idx": int}
    {"type": "narration_done"}
    {"type": "podcast_ready", "doc_id": str, "title": str, "n_turns": int, "turns": [{speaker,text}]}
    {"type": "podcast_turn", "turn_idx": int, "speaker": "host|guest", "text": "..."}
    {"type": "podcast_done"}
    {"type": "error", "message": "..."}
  Outbound binary frames: MP3 audio chunks for playback.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.settings import get_settings
from app.db.base import get_sessionmaker
from app.services.session import Session
from app.auth.deps import get_user_from_token
from app.utils.security_input import validate_doc_id

logger = logging.getLogger(__name__)
router = APIRouter()


# Hard upper bound on an inbound text frame. Real protocol messages are
# ~80 bytes; this is generous slack for pathological JSON.
_MAX_TEXT_FRAME_BYTES = 4 * 1024

# Disconnect a socket that hasn't sent any message for this many seconds.
_IDLE_TIMEOUT_SECONDS = 180

# Soft message-rate guard. The wire-protocol budget is ~30 control msgs/sec
# during active narration; anything past 100 is a misbehaving client.
_MAX_MSGS_PER_SECOND = 100


def _origin_allowed(ws: WebSocket) -> bool:
    """Reject WebSocket handshakes whose Origin isn't on the configured
    frontend allowlist. Matches the CORS policy applied to HTTP requests.

    Browsers always send an Origin header on cross-origin WS upgrades; we
    accept missing-Origin (e.g. curl, Postman, native clients) only in dev
    so the test harness still works.
    """
    origin = ws.headers.get("origin")
    s = get_settings()
    if origin is None:
        return s.app_env != "prod"
    return origin in s.cors_origin_list


@router.websocket("/ws/audio")
async def ws_audio(ws: WebSocket) -> None:
    conn_id = uuid.uuid4().hex[:8]
    client = f"{ws.client.host}:{ws.client.port}" if ws.client else "?"
    started = time.monotonic()
    text_msgs = 0

    logger.info("ws[%s] connect from %s", conn_id, client)

    # 1. Origin allowlist — equivalent to the CORS check on HTTP routes.
    if not _origin_allowed(ws):
        origin = ws.headers.get("origin")
        logger.warning("ws[%s] rejected: bad origin=%s", conn_id, origin)
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Token (query string — required because browsers can't set custom
    # headers on a WS upgrade). The token is treated like any other JWT and
    # must be unexpired + match a real user.
    token = ws.query_params.get("token")
    if not token:
        logger.warning("ws[%s] rejected: missing token", conn_id)
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    factory = get_sessionmaker()
    async with factory() as db:
        user = await get_user_from_token(token, db)
    if user is None:
        logger.warning("ws[%s] rejected: invalid token", conn_id)
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user_id = user.id

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
    session.user_id = user_id
    try:
        await send_json({"type": "ready"})
    except Exception:
        logger.exception("ws[%s] failed to send ready frame", conn_id)
        return

    # Lightweight per-second message-rate limiter
    msg_window_start = time.monotonic()
    msg_window_count = 0

    def _rate_ok() -> bool:
        nonlocal msg_window_start, msg_window_count
        now = time.monotonic()
        if now - msg_window_start >= 1.0:
            msg_window_start = now
            msg_window_count = 0
        msg_window_count += 1
        return msg_window_count <= _MAX_MSGS_PER_SECOND

    try:
        while True:
            try:
                msg = await asyncio.wait_for(ws.receive(), timeout=_IDLE_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                logger.info("ws[%s] idle timeout", conn_id)
                break

            if msg.get("type") == "websocket.disconnect":
                break

            if not _rate_ok():
                logger.warning("ws[%s] message-rate cap hit — closing", conn_id)
                await ws.close(code=status.WS_1008_POLICY_VIOLATION)
                break

            # Binary frames are no longer part of the protocol — voice
            # barge-in was removed when Whisper was dropped. Silently
            # ignore any binary payloads from misbehaving / outdated
            # clients rather than closing the socket.
            if "bytes" in msg and msg["bytes"] is not None:
                continue

            if "text" in msg and msg["text"] is not None:
                text = msg["text"]
                if len(text) > _MAX_TEXT_FRAME_BYTES:
                    logger.warning("ws[%s] dropping oversized text frame %d chars", conn_id, len(text))
                    continue
                text_msgs += 1
                try:
                    obj = json.loads(text)
                except json.JSONDecodeError:
                    logger.warning("ws[%s] invalid json (truncated): %r", conn_id, text[:120])
                    await send_json({"type": "error", "message": "invalid json"})
                    continue
                if not isinstance(obj, dict):
                    await send_json({"type": "error", "message": "invalid envelope"})
                    continue

                kind = obj.get("type")
                logger.debug("ws[%s] recv text type=%s", conn_id, kind)

                def _check_doc(d: object) -> str | None:
                    """Validate the doc_id payload field. Returns the
                    sanitized id on success, ``None`` after sending an
                    error frame (caller should `continue`).
                    """
                    if not isinstance(d, str) or not d:
                        return None
                    try:
                        return validate_doc_id(d)
                    except Exception:
                        return None

                if kind == "start_narration":
                    doc_id = _check_doc(obj.get("doc_id"))
                    if not doc_id:
                        await send_json({"type": "error", "message": "invalid doc_id"})
                        continue
                    try:
                        await session.start_narration(doc_id)
                    except Exception:
                        logger.exception("ws[%s] start_narration failed", conn_id)
                        await send_json({"type": "error", "message": "start_narration failed"})
                elif kind == "start_podcast":
                    doc_id = _check_doc(obj.get("doc_id"))
                    if not doc_id:
                        await send_json({"type": "error", "message": "invalid doc_id"})
                        continue
                    try:
                        await session.start_podcast(doc_id)
                    except Exception:
                        logger.exception("ws[%s] start_podcast failed", conn_id)
                        await send_json({"type": "error", "message": "start_podcast failed"})
                elif kind == "stop":
                    try:
                        await session.stop()
                    except Exception:
                        logger.exception("ws[%s] stop failed", conn_id)
                elif kind == "resume":
                    try:
                        await session.resume()
                    except Exception:
                        logger.exception("ws[%s] resume failed", conn_id)
                        await send_json({"type": "error", "message": "resume failed"})
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
            "ws[%s] closed after %.2fs user=%s text_msgs=%d",
            conn_id, elapsed, user_id, text_msgs,
        )
