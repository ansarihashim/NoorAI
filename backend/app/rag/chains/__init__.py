"""LangChain-based generation chains.

Each chain is a thin Runnable that:
  1. Pulls relevant document context via :class:`EchoVerseRetriever`
     (a wrapper around the existing rag_service).
  2. Fills a prompt template from :mod:`app.prompts`.
  3. Calls ChatGroq with structured output bound to a Pydantic schema
     from :mod:`app.schemas`.
  4. Returns a validated, grounded model object.

Chains do NOT manage caching or HTTP shape — the calling service
(e.g. :mod:`app.services.revision_service`) handles that.
"""
