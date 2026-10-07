import json
from io import BytesIO
from zipfile import ZipFile

import httpx

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
                    "score": "72.6",
                },
                {"name": "Budget", "summary": "Thin.", "recommendations": "Itemise.", "score": 140},
                {"section": "Outcomes", "score": None},
                "not-a-section",
            ]
        }
    )
    openai = mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(model_reply))

    response = _upload(client)

    assert response.status_code == 200
    assert response.json() == [
        {
            "section": "Executive Summary",
            "summary": "Clear.",
            "recommendations": ["Add need."],
            "score": 72,
        },
        {"section": "Budget", "summary": "Thin.", "recommendations": ["Itemise."], "score": 100},
        {"section": "Outcomes", "summary": "", "recommendations": [], "score": 0},
    ]

    sent = sent_json(openai)
    assert sent["model"] == "test-analysis-model"
    assert sent["response_format"] == {"type": "json_object"}
    assert "temperature" not in sent
    assert [m["role"] for m in sent["messages"]] == ["system", "user"]
    # Whitespace in the draft is collapsed before it is sent.
    assert sent["messages"][1]["content"].endswith(
        "Executive Summary We will build a youth hub. Budget We request $250,000."
    )


def test_analyze_truncates_long_drafts(client, mock_api):
    openai = mock_api.post(OPENAI_CHAT_URL).mock(
        return_value=openai_completion(json.dumps({"sections": [{"section": "A", "score": 1}]}))
    )
    prefix = "Analyze the following proposal and respond with JSON only.\n\n"

    _upload(client, b"x" * 20000)

    assert len(sent_json(openai)["messages"][1]["content"]) == len(prefix) + 15000


def test_analyze_falls_back_to_keywords_when_the_model_call_fails(client, mock_api):
    mock_api.post(OPENAI_CHAT_URL).mock(
        return_value=httpx.Response(400, json={"error": {"message": "bad request"}})
    )

    response = _upload(client)

    assert response.status_code == 200
    by_section = {item["section"]: item for item in response.json()}
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
    assert len(response.json()) == 7


def test_analyze_rejects_empty_and_blank_files(client, mock_api):
    empty = _upload(client, b"")
    blank = _upload(client, b"   \n  ")

    assert empty.status_code == 400
    assert empty.json()["detail"] == "Uploaded file is empty."
    assert blank.status_code == 400
    assert blank.json()["detail"] == "Uploaded file does not contain readable text for analysis."


def _export(client, payload: dict, files=None):
    return client.post("/api/proposals/export", data={"payload": json.dumps(payload)}, files=files)


def test_export_builds_a_docx(client):
    response = _export(
        client,
        {
            "project_title": "Riverbend Youth Hub & Café",
            "organization_name": "Riverbend First Nation",
            "submission_date": "2026-10-05",
            "executive_summary": "A place for youth.",
            "objectives": ["Open the hub", "Hire two staff"],
            "requested_amount": "$250,000",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert response.headers["content-disposition"] == (
        'attachment; filename="Riverbend-Youth-Hub-Caf-draft-proposal.docx"'
    )

    with ZipFile(BytesIO(response.content)) as docx:
        assert sorted(docx.namelist()) == [
            "[Content_Types].xml",
            "_rels/.rels",
            "docProps/app.xml",
            "docProps/core.xml",
            "word/_rels/document.xml.rels",
            "word/document.xml",
        ]
        document = docx.read("word/document.xml").decode()
        core = docx.read("docProps/core.xml").decode()

    assert "Riverbend Youth Hub &amp; Café" in document
    assert "Organization: Riverbend First Nation" in document
    assert "Submission Date: 2026-10-05" in document
    assert "A place for youth." in document
    assert "- Open the hub" in document
    assert "$250,000" in document
    assert "Information pending." in document  # sections with no content
    assert "<dc:title>Riverbend Youth Hub &amp; Café</dc:title>" in core


def test_export_includes_attachments(client):
    response = _export(
        client,
        {"project_title": "Riverbend Youth Hub", "organization_name": "Riverbend First Nation"},
        files=[
            ("attachments", ("notes.txt", b"Meeting notes", "text/plain")),
            ("attachments", ("photo.png", b"\x89PNG", "image/png")),
        ],
    )

    assert response.status_code == 200
    with ZipFile(BytesIO(response.content)) as docx:
        document = docx.read("word/document.xml").decode()
    assert "Attachment: notes.txt (0.0 KB)" in document
    assert "Meeting notes" in document
    assert "Binary file (base64 encoded):" in document


def test_export_rejects_a_payload_missing_required_fields(client):
    response = _export(client, {"projectTitle": "Wrong naming"})

    assert response.status_code == 400
    assert "project_title" in response.json()["detail"]


def test_create_proposal_returns_a_mock_id(client):
    response = client.post(
        "/api/proposals",
        json={"project_title": "Riverbend Youth Hub", "organization_name": "Riverbend First Nation"},
    )

    assert response.status_code == 201
    assert response.json() == {
        "message": "Proposal accepted for processing.",
        "proposal_id": "proposal-riverbend-youth-hub",
    }
