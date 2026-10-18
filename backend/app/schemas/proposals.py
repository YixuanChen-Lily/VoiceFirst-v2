from typing import List, Literal, Optional

from pydantic import BaseModel, Field


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


class ProposalPayload(BaseModel):
    project_title: str
    organization_name: str
    submission_date: Optional[str] = None
    executive_summary: Optional[str] = None
    community_background: Optional[str] = None
    problem_description: Optional[str] = None
    objectives: List[str] = Field(default_factory=list)
    milestones: List[str] = Field(default_factory=list)
    requested_amount: Optional[str] = None
    risks: Optional[str] = None


class ProposalResponse(BaseModel):
    message: str
    proposal_id: str
