"""Fill the proposal form from an existing draft, using the draft's own wording."""

import logging
from typing import Any, Dict

from fastapi import HTTPException

from ..clients import openai_client
from ..core import settings
from ..schemas.proposals import DraftFields, DraftFieldsResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You fill in a grant proposal form from the applicant's existing draft. "
    "For each field, copy the draft's own wording for that part; you may trim it to fit, "
    "join sentences from different places, or tidy formatting, but never add facts, numbers, "
    "names or claims the draft does not contain. If the draft says nothing about a field, "
    "leave it empty. Lists (milestones, budget lines, targets, risks) only include items the "
    "draft actually lists."
)


async def extract_fields(text: str) -> DraftFieldsResponse:
    if not openai_client.is_available():
        raise HTTPException(status_code=503, detail="Filling in fields from a draft isn't available right now.")
    try:
        result = await openai_client.complete_structured(
            model=settings.OPENAI_ANALYSIS_MODEL,
            response_model=DraftFields,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Fill in the form from this draft.\n\n" + text[: settings.ANALYSIS_MAX_CHARS]},
            ],
        )
    except Exception as exc:
        logger.warning("Filling fields from a draft failed: %s", exc)
        raise HTTPException(status_code=502, detail="Couldn't read the fields from your draft. Please try again.") from exc
    fields = result.model_dump()
    for row in fields.get("riskRows", []):
        # The form offers low / medium / high; anything else is left for the person to choose.
        likelihood = row.get("likelihood", "").strip().lower()
        row["likelihood"] = likelihood if likelihood in ("low", "medium", "high") else ""
    return DraftFieldsResponse(fields=_non_empty(fields))


def _non_empty(fields: Dict[str, Any]) -> Dict[str, Any]:
    """Drop blank text and empty lists, and trim what's left."""
    kept: Dict[str, Any] = {}
    for key, value in fields.items():
        if isinstance(value, str):
            if value.strip():
                kept[key] = value.strip()
        elif isinstance(value, list):
            rows = [
                {name: (cell.strip() if isinstance(cell, str) else cell) for name, cell in row.items()}
                for row in value
                if any(isinstance(cell, str) and cell.strip() for cell in row.values())
            ]
            if rows:
                kept[key] = rows
    return kept
