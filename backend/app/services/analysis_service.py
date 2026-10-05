"""Draft analysis: score each proposal section with the model, or with keywords if that fails."""

import json
import logging
from typing import List

from fastapi import HTTPException

from ..clients import openai_client
from ..core import settings
from ..schemas.proposals import DraftAnalysis

logger = logging.getLogger(__name__)


async def analyze_text(text: str) -> List[DraftAnalysis]:
    if openai_client.is_available():
        try:
            return await _analyze_with_openai(text)
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("OpenAI analysis failed, falling back to heuristic scoring: %s", exc)

    return _fallback_analysis(text)


async def _analyze_with_openai(text: str) -> List[DraftAnalysis]:
    condensed_text = text if len(text) <= 15000 else text[:15000]

    system_prompt = (
        "You are an expert grant reviewer. Assess the provided proposal text and "
        "score each major section between 0 and 100. Return JSON with a `sections` "
        "array. Each element must include `section`, `summary`, `recommendations` "
        "(array of strings), and `score` (integer)."
    )

    payload = await openai_client.complete_chat(
        model=settings.OPENAI_ANALYSIS_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": "Analyze the following proposal and respond with JSON only.\n\n" + condensed_text,
            },
        ],
    ) or "{}"

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:  # pragma: no cover - propagate parse failure
        raise ValueError("Unable to parse AI analysis response.") from exc

    sections = data.get("sections")
    if not isinstance(sections, list):
        raise ValueError("AI analysis response missing sections array.")

    results: List[DraftAnalysis] = []
    for section in sections:
        if not isinstance(section, dict):
            continue
        name = str(section.get("section") or section.get("name") or "Unknown Section")
        summary = str(section.get("summary") or "")
        recommendations = section.get("recommendations") or []
        if not isinstance(recommendations, list):
            recommendations = [str(recommendations)]

        score_raw = section.get("score")
        try:
            score = int(float(score_raw))
        except (TypeError, ValueError):
            score = 0

        score = max(0, min(100, score))

        results.append(
            DraftAnalysis(
                section=name,
                summary=summary,
                recommendations=[str(rec) for rec in recommendations if str(rec).strip()],
                score=score,
            )
        )

    if not results:
        raise ValueError("AI analysis did not return any sections.")

    return results


def _fallback_analysis(text: str) -> List[DraftAnalysis]:
    """Provide a deterministic heuristic analysis when AI is unavailable."""

    lower_text = text.lower()
    word_count = max(len(text.split()), 1)

    section_keywords = {
        "Executive Summary": ["executive", "summary", "overview"],
        "Community Context": ["community", "population", "needs", "demographic"],
        "Problem Statement": ["problem", "challenge", "issue"],
        "Project Description": ["project", "activities", "implementation"],
        "Budget": ["budget", "cost", "funding"],
        "Outcomes": ["outcome", "impact", "result"],
        "Risk Management": ["risk", "mitigation", "contingency"],
    }

    results: List[DraftAnalysis] = []
    for name, keywords in section_keywords.items():
        matches = sum(1 for keyword in keywords if keyword in lower_text)
        coverage_bonus = min(30, int(word_count / 200))
        score = 40 + matches * 12 + coverage_bonus
        score = max(30, min(92, score))

        if matches == 0:
            summary = f"{name} section appears to be missing or very light in detail."
            recommendations = [
                f"Add a dedicated section for {name.lower()} with clear specifics and quantifiable details.",
            ]
        else:
            summary = f"{name} content detected with {matches} key signal{'s' if matches == 1 else 's'}."
            recommendations = []
            if score < 75:
                recommendations.append(
                    f"Strengthen the {name.lower()} section with more evidence and funder-aligned language."
                )

        results.append(
            DraftAnalysis(
                section=name,
                summary=summary,
                recommendations=recommendations,
                score=score,
            )
        )

    return results
