"""
Structured field extraction: which fields each section may fill, what each field
means, and the reply shape the model must follow.

Each section gets its own reply model, built from the two tables below. The model's
reply is forced to match it through OpenAI structured outputs (via Instructor), so
field names cannot be invented and every field is either text or empty.
"""

import json
from functools import lru_cache
from typing import Dict, List, Optional, Type

from pydantic import BaseModel, Field, create_model

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



# What each form field holds. These descriptions are sent to the model with the
# reply shape, so they are what it uses to decide where a piece of information goes.
FIELD_DESCRIPTIONS: Dict[str, str] = {
    # Cover page
    "projectTitle": "The name of the project.",
    "organizationName": "The applicant: the community, First Nation or organization submitting the proposal.",
    "submissionDate": "The date the proposal will be submitted, as the user stated it.",
    "contactName": "Full name of the main contact person for the proposal.",
    "contactPhone": "Phone number of the main contact person.",
    "contactEmail": "Email address of the main contact person.",
    "contactAddress": "Mailing address of the applicant or contact person.",
    "fundedBy": "The funder or funding program the proposal is addressed to.",
    # Executive summary
    "executiveSummary": "A short overview of the whole proposal: what is proposed, for whom, why, and how much is requested.",
    # Community context
    "communityName": "The name of the community the project serves.",
    "population": "The community's population, as a number or short phrase.",
    "communityBackground": "History, location and general description of the community.",
    "economicBaseline": "The community's current economic situation: employment, main industries, income, businesses.",
    "culturalContext": "Culture, language, traditions and values relevant to the project.",
    "needsChallenges": "The needs, gaps and challenges the community faces that are relevant to the project.",
    # Problem statement
    "problemDescription": "The specific problem or opportunity the project addresses.",
    "supportingEvidence": "Data, statistics, studies or examples that back up the problem statement.",
    # Project description
    "objective1": "The first project objective.",
    "objective2": "The second project objective.",
    "objective3": "The third project objective.",
    "year1Activities": "Activities planned for the first year.",
    "year2Activities": "Activities planned for the second year.",
    "year3Activities": "Activities planned for the third year.",
    # Implementation
    "governanceStructure": "Who oversees the project and how decisions are made.",
    "implementationResponsibilities": "Who is responsible for carrying out which parts of the project.",
    "implementationPartnerships": "Partner organizations and what each contributes.",
    "implementationRiskOverview": "A brief overview of risks to delivering the project on time and on budget.",
    # Budget
    "totalBudget": "The total cost of the project, as an amount of money.",
    "requestedAmount": "The amount of funding requested from the funder.",
    "communityContribution": "What the community or applicant contributes, in cash or in kind.",
    "personnelBudget": "Budget for staff, wages and contractors.",
    "equipmentBudget": "Budget for equipment, materials and renovations.",
    "trainingBudget": "Budget for training and capacity building.",
    "marketingBudget": "Budget for marketing, outreach and communications.",
    "otherBudget": "Budget for costs that fit none of the other budget lines.",
    "sustainabilityPlan": "How the project will be paid for and kept running after the funding ends.",
    # Outcomes
    "expectedOutcomes": "The results and benefits the project is expected to produce.",
    "successIndicators": "Measurable indicators that will show the project succeeded.",
    "dataCollectionPlan": "How data on those indicators will be collected.",
    "evaluationPlan": "How and when the project will be evaluated.",
    # Alignment
    "communityAlignment": "How the project fits the community's own plans and priorities.",
    "funderAlignment": "How the project fits the funder's priorities and program criteria.",
    "longTermSustainability": "The lasting benefit of the project to the community over the long term.",
    # Risk management
    "risksMitigation": "The main risks to the project and how each will be reduced or handled.",
}

class ChatTurn(BaseModel):
    """The shape of a reply when no section is being filled in."""

    chat_reply: str


@lru_cache(maxsize=None)
def build_fields_model(section: int) -> Optional[Type[BaseModel]]:
    """A model with one optional text field per form field the section may fill."""
    config = SECTION_FIELD_CONFIG.get(section)
    if not config:
        return None
    fields = {
        name: (Optional[str], Field(default=None, description=FIELD_DESCRIPTIONS[name]))
        for name in config["fields"]
    }
    return create_model(f"Section{section}Fields", **fields)


@lru_cache(maxsize=None)
def build_turn_model(section: Optional[int]) -> Optional[Type[BaseModel]]:
    """The reply shape for a section: what to say, plus that section's form fields."""
    if section is None:
        return None
    fields_model = build_fields_model(section)
    if fields_model is None:
        return None
    return create_model(
        f"Section{section}ChatTurn",
        chat_reply=(str, Field(description="The natural-language reply to say to the user.")),
        field_updates=(
            fields_model,
            Field(description="Form fields to fill from this turn. Leave a field null unless this turn gives a value for it."),
        ),
    )


def build_extraction_instruction(section: Optional[int]) -> Optional[str]:
    """The system message that tells the model how to use the field_updates part of its reply."""
    config = SECTION_FIELD_CONFIG.get(section) if section is not None else None
    if not config:
        return None
    description = config.get("description", "the current section")
    return (
        f"You are also filling in a proposal form: {description}. "
        "Put what you say to the user in chat_reply. "
        "In field_updates, set a field only when the user has given that information or asked you to "
        "draft that field in this turn; leave every other field null. "
        "Field values must be plain text without markdown or commentary."
    )


def to_field_updates(fields: BaseModel) -> Optional[Dict[str, str]]:
    """Turn a filled fields model into a name-to-text dictionary, without empty values."""
    updates = {
        name: value.strip()
        for name, value in fields.model_dump().items()
        if isinstance(value, str) and value.strip()
    }
    return updates or None


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
