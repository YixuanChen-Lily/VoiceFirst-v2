from typing import List, Optional

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
