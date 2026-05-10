"""Centralized prompt templates used by the chains layer.

Keeping these out of the chain code makes prompt iteration cheap and lets
us share the grounded-output system prompt across every generation flow.
"""
