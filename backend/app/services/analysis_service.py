"""Draft analysis: score each proposal section with the model, or with keywords if that fails."""

import logging
from typing import List

from fastapi import HTTPException

from ..clients import openai_client
from ..core import settings
from ..schemas.proposals import DraftAnalysis, DraftAnalysisResponse, DraftAnalysisResult

logger = logging.getLogger(__name__)


async def analyze_text(text: str) -> DraftAnalysisResponse:
    """
    Score a draft section by section. The text keeps its paragraph breaks so the
    model can see where sections start. Only an extremely long draft is cut short,
    and the response says so.
    """
    analysed = text[: settings.ANALYSIS_MAX_CHARS]
    sections, method = None, "keywords"
    if openai_client.is_available():
        try:
            sections, method = await _analyze_with_openai(analysed), "model"
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("OpenAI analysis failed, falling back to heuristic scoring: %s", exc)
    if sections is None:
        sections = _fallback_analysis(analysed)

    return DraftAnalysisResponse(
        sections=sections,
        method=method,
        truncated=len(analysed) < len(text),
        characters_analysed=len(analysed),
        characters_total=len(text),
    )


async def _analyze_with_openai(text: str) -> List[DraftAnalysis]:
    system_prompt = (
        "You are an expert grant reviewer. Assess the provided proposal text and "
        "score each major section between 0 and 100, with a short summary and "
        "actionable recommendations for each."
    )

    result = await openai_client.complete_structured(
        model=settings.OPENAI_ANALYSIS_MODEL,
        response_model=DraftAnalysisResult,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Analyze the following proposal.\n\n" + text},
        ],
    )

    sections = [
        section.model_copy(
            update={"recommendations": [item.strip() for item in section.recommendations if item.strip()]}
        )
        for section in result.sections
    ]
    if not sections:
        raise ValueError("AI analysis did not return any sections.")
    return sections


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
