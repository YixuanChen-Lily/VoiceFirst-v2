from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DraftAnalysis(BaseModel):
    section: str = Field(..., description="Proposal section identifier")
    summary: str = Field(..., description="Auto-generated summary or findings")
    recommendations: List[str] = Field(
        default_factory=list,
        description="Actionable recommendations derived from the draft content",
    )
    score: int = Field(
        0,
        ge=0,
        le=100,
        description="Section competitiveness score between 0 and 100",
    )


class DraftAnalysisResult(BaseModel):
    """The shape the analysis model must reply in."""

    sections: List[DraftAnalysis] = Field(
        ..., description="One entry per major section present in the proposal."
    )


class DraftAnalysisResponse(BaseModel):
    """What the analysis endpoint returns."""

    sections: List[DraftAnalysis]
    method: Literal["model", "keywords"] = Field(
        ..., description="'keywords' means the AI analysis was unavailable and a simple keyword check was used."
    )
    truncated: bool = Field(..., description="True when only the start of a very long draft was analysed.")
    characters_analysed: int
    characters_total: int


class FormMilestone(BaseModel):
    name: str = Field("", description="What will be done")
    date: str = Field("", description="When, in the draft's own words (a date, month or quarter)")


class FormBudgetLine(BaseModel):
    category: str = Field("", description="Cost category, e.g. Staff, Equipment, Construction")
    description: str = Field("", description="What the money is for")
    amount: str = Field("", description="Amount as written in the draft, digits only if possible")


class FormIndicator(BaseModel):
    indicator: str = Field("", description="What is measured, e.g. Households served")
    baseline: str = Field("", description="Where things are now")
    target: str = Field("", description="Where the project aims to get")
    year: str = Field("", description="By when")


class FormRisk(BaseModel):
    risk: str = Field("", description="What could go wrong")
    likelihood: str = Field("", description="How likely: low, medium or high, if stated")
    mitigation: str = Field("", description="What the applicant will do about it")


class ProposalForm(BaseModel):
    """The proposal form as the website holds it (camelCase keys). Other keys are ignored."""

    @model_validator(mode="before")
    @classmethod
    def _drop_missing(cls, value: Any) -> Any:
        """Older saved forms may hold null for a field; treat it as empty."""
        if isinstance(value, dict):
            return {key: item for key, item in value.items() if item is not None}
        return value

    projectTitle: str = Field("", description="Name of the project")
    organizationName: str = Field("", description="Organization applying")
    submissionDate: str = Field("", description="Submission date, as YYYY-MM-DD if the draft gives one")
    contactName: str = ""
    contactPhone: str = ""
    contactEmail: str = ""
    contactAddress: str = Field("", description="Mailing address")
    fundedBy: str = Field("", description="Funder or funding program applied to")
    executiveSummary: str = Field("", description="The executive summary or overview")
    communityName: str = ""
    population: str = ""
    communityBackground: str = Field("", description="About the community: where, who lives there, daily life")
    economicBaseline: str = Field("", description="Local economy")
    culturalContext: str = Field("", description="Culture, language, land and environment")
    needsChallenges: str = Field("", description="Challenges the community faces")
    problemDescription: str = Field("", description="The problem or opportunity the project addresses")
    supportingEvidence: str = Field("", description="Statistics, survey results or testimony backing the need")
    objective1: str = Field("", description="First goal or objective")
    objective2: str = Field("", description="Second goal or objective")
    objective3: str = Field("", description="Third goal or objective")
    year1Activities: str = ""
    year2Activities: str = ""
    year3Activities: str = ""
    governanceStructure: str = Field("", description="Who oversees the project and how decisions are made")
    implementationResponsibilities: str = Field("", description="Key people or roles and what each does")
    implementationPartnerships: str = Field("", description="Partner organizations")
    implementationRiskOverview: str = Field("", description="A brief note on main risks, if given with the plan")
    milestones: List[FormMilestone] = Field(default_factory=list, description="Up to 6 milestones")
    totalBudget: str = Field("", description="Total project cost")
    requestedAmount: str = Field("", description="Amount requested from this funder")
    communityContribution: str = ""
    personnelBudget: str = Field("", description="Staff costs")
    equipmentBudget: str = ""
    trainingBudget: str = ""
    marketingBudget: str = Field("", description="Promotion or marketing costs")
    otherBudget: str = Field("", description="Funding from other sources")
    sustainabilityPlan: str = Field("", description="How the project continues after the grant")
    budgetLines: List[FormBudgetLine] = Field(default_factory=list, description="Itemized costs, if listed")
    expectedOutcomes: str = Field("", description="What will change")
    successIndicators: str = Field("", description="How they'll know it worked")
    dataCollectionPlan: str = ""
    evaluationPlan: str = ""
    indicators: List[FormIndicator] = Field(default_factory=list, description="Measurable targets, if listed")
    communityAlignment: str = Field("", description="How the project fits the community's plans")
    funderAlignment: str = Field("", description="How the project fits the funder's priorities")
    longTermSustainability: str = Field("", description="Lasting benefits after funding ends")
    risksMitigation: str = Field("", description="Summary of risks and how they'll be handled")
    riskRows: List[FormRisk] = Field(default_factory=list, description="Individual risks, if listed")


class DraftFields(ProposalForm):
    """The form filled from an existing draft. Anything the draft doesn't cover stays empty."""


class ProposalDocument(ProposalForm):
    """What the Word download is built from: the form, plus a field older proposals may still hold."""

    alignmentDescription: str = ""


class DraftFieldsResponse(BaseModel):
    """Only the fields the draft covers; the website leaves the rest as they are."""

    fields: Dict[str, Any]


class ProposalSaveRequest(BaseModel):
    """The proposal form, as the website holds it."""

    data: Dict[str, Any]


class ProposalSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class SavedProposal(ProposalSummary):
    data: Dict[str, Any]
