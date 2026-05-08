"""Groq LLM client. Streams tokens for both narration-refinement and Q&A."""
from __future__ import annotations

import logging
from typing import AsyncIterator

from groq import AsyncGroq

from backend.config.settings import get_settings

logger = logging.getLogger(__name__)


SYSTEM_PROMPT_QA = """You are EchoVerse, a real-time conversational study buddy.
The user is listening to their own notes being narrated and has just interrupted to ask a question.

Rules:
- Answer using ONLY the provided NOTES context. If the answer isn't in the notes, say so briefly and offer the closest related point.
- Keep answers SHORT and SPOKEN-friendly: 1-3 sentences, no bullet points, no markdown, no code blocks unless explicitly requested.
- Sound conversational and warm, like a friend explaining at a desk.
- Do NOT repeat the question. Do NOT preface with "Sure" or "Great question".
"""


SYSTEM_PROMPT_REFINE = """You are a narration polisher. Rewrite the given text so it reads aloud well:
expand acronyms on first use, smooth choppy fragments, keep meaning exact. No markdown, no headings.
Output the rewritten text only, nothing else.
"""


class GroqService:
    def __init__(self) -> None:
        s = get_settings()
        if not s.groq_api_key:
            logger.warning("GROQ_API_KEY is not set; Groq calls will fail.")
        self._client = AsyncGroq(api_key=s.groq_api_key)
        self._model = s.groq_model

    async def answer(
        self,
        question: str,
        context_chunks: list[str],
        history: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """Stream the answer as text deltas."""
        ctx = "\n\n---\n\n".join(context_chunks) if context_chunks else "(no relevant notes found)"
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_QA},
            {"role": "system", "content": f"NOTES:\n{ctx}"},
        ]
        if history:
            messages.extend(history[-6:])  # cap memory
        messages.append({"role": "user", "content": question})

        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=0.4,
            max_tokens=350,
            stream=True,
        )
        async for part in stream:
            delta = part.choices[0].delta.content if part.choices else None
            if delta:
                yield delta

    async def refine(self, text: str) -> str:
        """One-shot polish of a narration chunk. Falls back to original on error."""
        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_REFINE},
                    {"role": "user", "content": text},
                ],
                temperature=0.2,
                max_tokens=600,
            )
            return resp.choices[0].message.content.strip() or text
        except Exception as exc:
            logger.warning("Groq refine failed, using original text: %s", exc)
            return text


_singleton: GroqService | None = None


def get_groq() -> GroqService:
    global _singleton
    if _singleton is None:
        _singleton = GroqService()
    return _singleton
