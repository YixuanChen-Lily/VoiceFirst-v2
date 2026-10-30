import json
from io import BytesIO

import httpx
import pytest

from backend.app.core import settings

from .conftest import OPENAI_CHAT_URL, openai_completion, sent_json

DRAFT = b"Executive Summary\nWe will build a youth hub.\n\nBudget\nWe request $250,000.\n"


def _upload(client, content: bytes = DRAFT):
    return client.post("/api/proposals/analyze", files={"file": ("draft.txt", content, "text/plain")})


def test_analyze_returns_model_scores(client, mock_api):
    model_reply = json.dumps(
        {
            "sections": [
                {
                    "section": "Executive Summary",
                    "summary": "Clear.",
                    "recommendations": ["Add need.", "  "],
                    "score": 72,
                },
                {"section": "Budget", "summary": "Thin.", "recommendations": [], "score": 40},
            ]
        }
    )
    openai = mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(model_reply))

    response = _upload(client)

    assert response.status_code == 200
    assert response.json() == {
        "sections": [
            {
                "section": "Executive Summary",
                "summary": "Clear.",
                "recommendations": ["Add need."],
                "score": 72,
            },
            {"section": "Budget", "summary": "Thin.", "recommendations": [], "score": 40},
        ],
        "method": "model",
        "truncated": False,
        "characters_analysed": len(DRAFT.decode().strip()),
        "characters_total": len(DRAFT.decode().strip()),
    }

    sent = sent_json(openai)
    assert sent["model"] == "test-analysis-model"
    assert "temperature" not in sent
    assert [m["role"] for m in sent["messages"]] == ["system", "user"]
    # Paragraph breaks are kept so the model can see where sections start.
    assert sent["messages"][1]["content"].endswith(
        "Executive Summary\nWe will build a youth hub.\n\nBudget\nWe request $250,000."
    )
    # The reply shape is sent to OpenAI as a structured-output schema.
    assert sent["response_format"]["type"] == "json_schema"
    schema = json.dumps(sent["response_format"]["json_schema"])
    assert all(f'"{name}"' in schema for name in ("sections", "section", "summary", "recommendations", "score"))


@pytest.mark.parametrize(
    "bad_reply",
    [
        {"sections": [{"section": "Budget", "summary": "x", "recommendations": [], "score": 140}]},
        {"sections": [{"section": "Budget", "summary": "x", "recommendations": [], "score": "high"}]},
        {"sections": "none"},
        {"something_else": []},
    ],
    ids=["score out of range", "score not a number", "sections not a list", "wrong shape"],
)
def test_analyze_falls_back_when_the_reply_does_not_match_the_shape(client, mock_api, bad_reply):
    openai = mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(json.dumps(bad_reply)))

    response = _upload(client)

    assert response.status_code == 200
    assert response.json()["method"] == "keywords"
    assert len(response.json()["sections"]) == 7  # the keyword fallback always returns its seven sections
    assert len(openai.calls) == 2  # asked once, then once more before giving up


def test_analyze_reads_long_drafts_in_full(client, mock_api):
    openai = mock_api.post(OPENAI_CHAT_URL).mock(
        return_value=openai_completion(json.dumps({"sections": [{"section": "A", "summary": "", "recommendations": [], "score": 1}]}))
    )
    long_draft = ("Budget\n" + "Renovation costs are itemised here. " * 1000).encode()  # about 36,000 characters

    body = _upload(client, long_draft).json()

    sent = sent_json(openai)["messages"][1]["content"]
    assert "Renovation costs are itemised here." in sent[-60:]  # the end of the draft is included
    assert body["truncated"] is False
    assert body["characters_analysed"] == body["characters_total"] > 15000


def test_analyze_says_when_an_extremely_long_draft_is_cut_short(client, mock_api, monkeypatch):
    monkeypatch.setattr(settings, "ANALYSIS_MAX_CHARS", 1000)
    openai = mock_api.post(OPENAI_CHAT_URL).mock(
        return_value=openai_completion(json.dumps({"sections": [{"section": "A", "summary": "", "recommendations": [], "score": 1}]}))
    )
    prefix = "Analyze the following proposal.\n\n"

    body = _upload(client, b"x" * 5000).json()

    assert len(sent_json(openai)["messages"][1]["content"]) == len(prefix) + 1000
    assert body["truncated"] is True
    assert (body["characters_analysed"], body["characters_total"]) == (1000, 5000)


def test_analyze_falls_back_to_keywords_when_the_model_call_fails(client, mock_api):
    mock_api.post(OPENAI_CHAT_URL).mock(
        return_value=httpx.Response(400, json={"error": {"message": "bad request"}})
    )

    response = _upload(client)

    assert response.status_code == 200
    assert response.json()["method"] == "keywords"
    by_section = {item["section"]: item for item in response.json()["sections"]}
    assert list(by_section) == [
        "Executive Summary",
        "Community Context",
        "Problem Statement",
        "Project Description",
        "Budget",
        "Outcomes",
        "Risk Management",
    ]
    assert by_section["Executive Summary"]["score"] == 64  # 40 + two keyword hits * 12
    assert by_section["Risk Management"] == {
        "section": "Risk Management",
        "summary": "Risk Management section appears to be missing or very light in detail.",
        "recommendations": [
            "Add a dedicated section for risk management with clear specifics and quantifiable details."
        ],
        "score": 40,
    }


def test_analyze_falls_back_when_the_model_returns_no_sections(client, mock_api):
    mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(json.dumps({"sections": []})))

    response = _upload(client)

    assert response.status_code == 200
    assert response.json()["method"] == "keywords"
    assert len(response.json()["sections"]) == 7


def test_analyze_rejects_empty_and_blank_files(client, mock_api):
    empty = _upload(client, b"")
    blank = _upload(client, b"   \n  ")

    assert empty.status_code == 400
    assert empty.json()["detail"] == "Uploaded file is empty."
    assert blank.status_code == 400
    assert blank.json()["detail"] == "Uploaded file does not contain readable text for analysis."


def _export(client, payload: dict, files=None):
    return client.post("/api/proposals/export", data={"payload": json.dumps(payload)}, files=files)


def _document_text(content: bytes) -> str:
    """All paragraphs and table cells of a .docx, one per line."""
    from docx import Document

    doc = Document(BytesIO(content))
    lines = [paragraph.text for paragraph in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            lines.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(lines)


FULL_FORM = {
    "projectTitle": "Riverbend Youth Hub & Café",
    "organizationName": "Riverbend First Nation",
    "fundedBy": "Northern Youth Fund",
    "submissionDate": "2026-10-05",
    "contactName": "Ana Morin",
    "contactEmail": "ana@example.org",
    "executiveSummary": "A place for youth.\n\nOpen every evening.",
    "communityName": "Riverbend",
    "population": "1,140",
    "communityBackground": "A river community.",
    "problemDescription": "Youth have nowhere to go.",
    "supportingEvidence": "Survey of 80 youth.",
    "objective1": "Open the hub",
    "objective2": "Hire two staff",
    "objective3": "",
    "year1Activities": "Renovate the building.",
    "governanceStructure": "A youth council reports to Chief and Council.",
    "milestones": [{"name": "Hub opens", "date": "June 2027"}, {"name": "", "date": ""}],
    "totalBudget": "$300,000",
    "requestedAmount": "$250,000",
    "budgetLines": [
        {"category": "Capital", "description": "Renovation", "amount": "$200,000"},
        {"category": "Staff", "description": "Two youth workers", "amount": "50,000"},
        {"category": "Training", "description": "", "amount": ""},
    ],
    "sustainabilityPlan": "Café income covers staff from Year 3.",
    "expectedOutcomes": "Youth have a safe place.",
    "indicators": [{"indicator": "Youth visits per week", "baseline": "0", "target": "60", "year": "2028"}],
    "funderAlignment": "Matches the fund's youth priority.",
    "riskRows": [{"risk": "Building delays", "likelihood": "medium", "mitigation": "Book contractors early"}],
    "risksMitigation": "We have a contingency budget.",
    "attachmentChecklist": {"lettersOfSupport": True},
}


def test_export_includes_the_whole_form(client):
    response = _export(client, FULL_FORM)

    assert response.status_code == 200
    assert response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert response.headers["content-disposition"] == (
        'attachment; filename="Riverbend-Youth-Hub-Caf-draft-proposal.docx"'
    )
    text = _document_text(response.content)
    for expected in [
        "Riverbend Youth Hub & Café",
        "Submitted by: Riverbend First Nation",
        "Submitted to: Northern Youth Fund",
        "Amount requested: $250,000",
        "Ana Morin",
        "A place for youth.",
        "Open every evening.",
        "Riverbend · Population: 1,140",
        "A river community.",
        "Youth have nowhere to go.",
        "Survey of 80 youth.",
        "Open the hub",
        "Hire two staff",
        "Renovate the building.",
        "A youth council reports to Chief and Council.",
        "Hub opens | June 2027",
        "Total project cost | $300,000",
        "Capital | Renovation | $200,000",
        "Staff | Two youth workers | 50,000",
        "Total |  | $250,000",
        "Café income covers staff from Year 3.",
        "Youth visits per week | 0 | 60 | 2028",
        "Matches the fund's youth priority.",
        "Building delays | Medium | Book contractors early",
        "We have a contingency budget.",
    ]:
        assert expected in text, expected
    assert "Training |  | " not in text  # empty table rows are left out
    assert "Not filled in yet." not in text  # every part has something


def test_export_of_an_empty_form_still_builds(client):
    response = _export(client, {})

    assert response.status_code == 200
    text = _document_text(response.content)
    assert "Untitled Project" in text
    assert text.count("Not filled in yet.") == 9


def test_export_reads_older_saved_forms(client):
    response = _export(client, {"projectTitle": "Old one", "executiveSummary": None, "alignmentDescription": "Fits."})

    assert response.status_code == 200
    assert "Fits." in _document_text(response.content)


def test_export_ignores_files_sent_with_the_request(client):
    """Files are never pasted into the document, whatever the request carries."""
    response = _export(
        client,
        {"projectTitle": "Riverbend Youth Hub"},
        files=[("attachments", ("photo.png", b"\x89PNG", "image/png"))],
    )

    assert response.status_code == 200
    assert "photo.png" not in _document_text(response.content)


def test_export_rejects_a_form_with_the_wrong_shape(client):
    response = _export(client, {"projectTitle": "Riverbend", "milestones": "not a list"})

    assert response.status_code == 400
    assert "milestones" in response.json()["detail"]

