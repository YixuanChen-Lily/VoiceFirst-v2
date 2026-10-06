"""Thin wrapper around TypeSafe's Jev decision model. Services call this, never the SDK."""

from functools import lru_cache

from langchain_typesafe import Noul, NoulCriteria, TypeSafeClassifier

from ..core import settings

# The router runs before every chat reply, so it must fail fast rather than stall the turn.
_TIMEOUT_SECONDS = 5.0
_QUESTION_ID = "question"


def is_available() -> bool:
    return bool(settings.TYPESAFE_API_KEY)


@lru_cache(maxsize=1)
def _get_classifier() -> TypeSafeClassifier:
    return TypeSafeClassifier(
        model=settings.TYPESAFE_ROUTER_MODEL,
        api_key=settings.TYPESAFE_API_KEY,
        timeout=_TIMEOUT_SECONDS,
    )


async def yes_probability(*, text: str, instructions: str, yes_means: str, no_means: str) -> float:
    """Ask one yes/no question about `text` and return the probability of yes (0 to 1)."""
    question = Noul(
        instructions=instructions,
        criteria=NoulCriteria(true=yes_means, false=no_means),
    )
    response = await _get_classifier().ainvoke(
        {"state": text, "questions": {_QUESTION_ID: question}}
    )
    return response.nouls[_QUESTION_ID].noul
