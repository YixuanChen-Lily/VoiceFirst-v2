"""Structured field extraction: which fields each section may fill, and how replies are parsed."""

import json
from typing import Dict, List, Optional

SECTION_FIELD_CONFIG: Dict[int, Dict[str, List[str]]] = {
    0: {
        "description": "Quick start intake overview",
        "fields": [
            "projectTitle",
            "organizationName",
            "executiveSummary",
            "problemDescription",
            "expectedOutcomes",
            "objective1",
            "communityBackground",
            "needsChallenges",
        ],
    },
    1: {
        "description": "Cover Page details",
        "fields": [
            "projectTitle",
            "organizationName",
            "submissionDate",
            "contactName",
            "contactPhone",
            "contactEmail",
            "contactAddress",
            "fundedBy",
        ],
    },
    2: {
        "description": "Executive Summary narrative",
        "fields": ["executiveSummary"],
    },
    3: {
        "description": "Community and background context",
        "fields": [
            "communityName",
            "population",
            "communityBackground",
            "economicBaseline",
            "culturalContext",
            "needsChallenges",
        ],
    },
    4: {
        "description": "Problem / Opportunity statement details",
        "fields": ["problemDescription", "supportingEvidence"],
    },
    5: {
        "description": "Project objectives and yearly activities",
        "fields": [
            "objective1",
            "objective2",
            "objective3",
            "year1Activities",
            "year2Activities",
            "year3Activities",
        ],
    },
    6: {
        "description": "Implementation plan details",
        "fields": [
            "governanceStructure",
            "implementationResponsibilities",
            "implementationPartnerships",
            "implementationRiskOverview",
        ],
    },
    7: {
        "description": "Budget and financial plan",
        "fields": [
            "totalBudget",
            "requestedAmount",
            "communityContribution",
            "personnelBudget",
            "equipmentBudget",
            "trainingBudget",
            "marketingBudget",
            "otherBudget",
            "sustainabilityPlan",
        ],
    },
    8: {
        "description": "Expected outcomes and evaluation plans",
        "fields": [
            "expectedOutcomes",
            "successIndicators",
            "dataCollectionPlan",
            "evaluationPlan",
        ],
    },
    9: {
        "description": "Alignment with priorities and sustainability",
        "fields": [
            "communityAlignment",
            "funderAlignment",
            "longTermSustainability",
        ],
    },
    10: {
        "description": "Risk management overview",
        "fields": ["risksMitigation"],
    },
}


def build_format_instruction(section: Optional[int]) -> Optional[str]:
    if section is None:
        return None
    config = SECTION_FIELD_CONFIG.get(section)
    if not config:
        return None
    allowed_fields = ", ".join(config["fields"])
    description = config.get("description", "the current section")
    return (
        f"You are extracting structured data for {description}. "
        "Respond strictly with a JSON object shaped as "
        '{"chat_reply": "<natural language response for the user>", '
        '"field_updates": { "<field>": "<value>" }}. '
        f"Only include keys in field_updates from this allowlist: {allowed_fields}. "
        "If you have no structured updates, return an empty object for field_updates. "
        "All field values must be plain strings without markdown or trailing commentary. "
        "Do not wrap the JSON in code fences or include text outside the JSON object."
    )


def parse_structured_response(content: str) -> tuple[str, Optional[Dict[str, str]]]:
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if "\n" in stripped:
            stripped = stripped.split("\n", 1)[1]

    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        return content, None

    chat_reply = payload.get("chat_reply")
    if not isinstance(chat_reply, str) or not chat_reply.strip():
        chat_reply = content

    raw_updates = payload.get("field_updates")
    field_updates: Optional[Dict[str, str]] = None
    if isinstance(raw_updates, dict):
        extracted: Dict[str, str] = {}
        for key, value in raw_updates.items():
            if isinstance(value, str) and value.strip():
                extracted[key] = value.strip()
        if extracted:
            field_updates = extracted

    return chat_reply, field_updates


def filter_field_updates(
    section: Optional[int], field_updates: Optional[Dict[str, str]]
) -> Optional[Dict[str, str]]:
    """Drop any proposed field that is not on the section's allowlist."""
    if not field_updates:
        return field_updates
    section_key = section if section is not None else -1
    allowed = set(SECTION_FIELD_CONFIG.get(section_key, {}).get("fields", []))
    if not allowed:
        return field_updates
    filtered = {key: value for key, value in field_updates.items() if key in allowed}
    return filtered or None
