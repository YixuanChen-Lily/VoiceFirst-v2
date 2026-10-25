"""Library and proposal-file passages in chat: looked up, given to the model, cited, and kept out of fields and speech."""

import json
from datetime import datetime, timezone

import httpx
import pytest

from backend.app.clients.document_store import DocumentRecord
from backend.app.clients.proposal_file_store import ProposalFileLink
from backend.app.schemas.documents import SearchResult
from backend.app.services import chat_graph
from backend.app.services.proposal_files_service import ProposalFile

from .conftest import OPENAI_CHAT_URL, TTS_URL_PREFIX, openai_completion, sent_json

CASH_RULE = SearchResult(
    document_id="doc-corp",
    title="CORP Program Guidelines.txt",
    filename="CORP Program Guidelines.txt",
    scope="library",
    page=None,
    section="Project approval criteria",
    text="CORP Program Guidelines › Project approval criteria\n\n- the applicant must contribute a minimum 10% cash contribution",
    distance=0.31,
)
FAR_AWAY = SearchResult(
    document_id="doc-other",
    title="Unrelated policy.txt",
    filename="Unrelated policy.txt",
    scope="library",
    page=4,
    section="Travel",
    text="Unrelated policy › Travel\n\nMileage is paid at the government rate.",
    distance=0.72,
)


@pytest.fixture
def library(monkeypatch):
    """Let a test choose what the library search returns, and record the queries."""
    calls = []
    results = {"value": [CASH_RULE, FAR_AWAY]}

    def fake_search(query, user_id, document_ids):
        calls.append((query, user_id, document_ids))
        if isinstance(results["value"], Exception):
            raise results["value"]
        return results["value"]

    monkeypatch.setattr(chat_graph, "_search_library", fake_search)
    results["calls"] = calls
    return results


@pytest.fixture
def tts(mock_api):
    return mock_api.post(TTS_URL_PREFIX + "test-voice").mock(return_value=httpx.Response(200, content=b"mp3"))


def _reply(mock_api, chat_reply, field_updates=None):
    return mock_api.post(OPENAI_CHAT_URL).mock(
        return_value=openai_completion(json.dumps({"chat_reply": chat_reply, "field_updates": field_updates or {}}))
    )


def _chat(client, message="How much cash do we need to contribute to CORP?", section=7, **extra):
    return client.post("/api/assist/chat", json={"message": message, "section": section, **extra})


def test_close_passages_are_given_to_the_model_numbered(client, mock_api, library, tts):
    openai = _reply(mock_api, "You need at least 10% in cash [1].")

    _chat(client)

    messages = sent_json(openai)["messages"]
    passages = messages[-2]
    assert passages["role"] == "system"
    assert "cite it right after the statement" in passages["content"]
    assert "[1] CORP Program Guidelines.txt › Project approval criteria\n- the applicant must contribute" in passages["content"]
    assert "Mileage" not in passages["content"]  # too far in meaning to be used
    assert messages[-1] == {"role": "user", "content": "How much cash do we need to contribute to CORP?"}
    assert library["calls"] == [("How much cash do we need to contribute to CORP?", "user-staff", [])]


def test_cited_passages_come_back_as_sources(client, mock_api, library, tts):
    _reply(mock_api, "You need at least 10% in cash [1].")

    body = _chat(client).json()

    assert body["message"] == "You need at least 10% in cash [1]."
    assert body["sources"] == [
        {
            "number": 1,
            "document_id": "doc-corp",
            "title": "CORP Program Guidelines.txt",
            "section": "Project approval criteria",
            "page": None,
            "origin": "library",
        }
    ]


def test_passages_the_reply_does_not_cite_are_not_listed(client, mock_api, library, tts):
    _reply(mock_api, "Hello! How can I help?")

    assert _chat(client, message="Hi there").json()["sources"] == []


def test_citations_are_not_spoken_or_written_into_fields(client, mock_api, library, tts):
    _reply(
        mock_api,
        "The program needs a 10% cash contribution [1].",
        {"communityContribution": "At least 10% cash [1]"},
    )

    body = _chat(client).json()

    assert json.loads(tts.calls[0].request.content)["text"] == "The program needs a 10% cash contribution."
    assert body["field_updates"] == {"communityContribution": "At least 10% cash"}


def test_no_close_passages_means_no_library_message(client, mock_api, library, tts):
    library["value"] = [FAR_AWAY]
    openai = _reply(mock_api, "Hello.")

    _chat(client, message="Hi there")

    assert not any("document library" in m["content"] for m in sent_json(openai)["messages"])


def test_a_failed_library_search_does_not_stop_the_reply(client, mock_api, library, tts):
    library["value"] = RuntimeError("database unreachable")
    _reply(mock_api, "Here is what I can say without the library.")

    response = _chat(client)

    assert response.status_code == 200
    assert response.json()["sources"] == []


def test_graph_runs_retrieval_before_answering():
    edges = {(edge.source, edge.target) for edge in chat_graph.chat_graph.get_graph().edges}

    assert ("classify", "retrieve") in edges
    assert ("retrieve", "generate_simple") in edges and ("retrieve", "generate_complex") in edges


def _file(document_id, title, role, use_in_chat, status="ready", label=None):
    now = datetime.now(timezone.utc)
    record = DocumentRecord(
        id=document_id, scope="personal", owner_id="user-staff", title=title, filename=title,
        content_type="application/pdf", kind="pdf", doc_type=None, funder=None,
        storage_path=f"personal/{document_id}/{title}", size_bytes=1000, status=status,
        error=None, chunk_count=3 if status == "ready" else 0, created_at=now,
    )
    link = ProposalFileLink("riverbend", document_id, "user-staff", role, label, use_in_chat, now)
    return ProposalFile(link=link, record=record)


BUDGET = SearchResult(
    document_id="doc-budget",
    title="budget.xlsx",
    filename="budget.xlsx",
    scope="personal",
    page=None,
    section="Budget",
    text="budget › Budget\n\nPersonnel | 85000",
    distance=0.2,
)


@pytest.fixture
def proposal_files(monkeypatch):
    files = [
        _file("doc-plan", "Community plan.pdf", "background", True),
        _file("doc-budget", "budget.xlsx", "attachment", True, label="Budget Spreadsheet"),
        _file("doc-resume", "resume.pdf", "attachment", False, status="stored", label="Staff Resumes"),
    ]
    calls = []

    def fake_files(user_id, proposal_id):
        calls.append((user_id, proposal_id))
        return files

    monkeypatch.setattr(chat_graph, "_proposal_files", fake_files)
    return {"files": files, "calls": calls}


def test_the_proposals_readable_files_are_searched_and_named(client, mock_api, library, proposal_files, tts):
    library["value"] = [BUDGET, CASH_RULE]
    openai = _reply(mock_api, "Personnel is $85,000 [1].")

    body = _chat(client, message="What is our personnel budget?", proposal_id="riverbend").json()

    assert proposal_files["calls"] == [("user-staff", "riverbend")]
    # Only switched-on, indexed files are searched; the resume is not.
    assert library["calls"][0][2] == ["doc-plan", "doc-budget"]

    contents = [message["content"] for message in sent_json(openai)["messages"]]
    files_message = next(content for content in contents if "part of the user's proposal" in content)
    assert "- Community plan.pdf (background document, readable)" in files_message
    assert "- Budget Spreadsheet: budget.xlsx (attachment, readable)" in files_message
    assert "- Staff Resumes: resume.pdf (attachment, name only)" in files_message
    passages_message = next(content for content in contents if "cite it right after" in content)
    assert "[1] budget.xlsx › Budget [the user's attachment]\nPersonnel | 85000" in passages_message

    assert body["sources"][0]["origin"] == "attachment"


def test_without_a_proposal_only_the_library_is_searched(client, mock_api, library, proposal_files, tts):
    openai = _reply(mock_api, "Hello.")

    _chat(client, message="Hi there")

    assert proposal_files["calls"] == []
    assert library["calls"][0][2] == []
    assert not any("part of the user's proposal" in m["content"] for m in sent_json(openai)["messages"])


def test_a_failure_loading_files_still_searches_the_library(client, mock_api, library, monkeypatch, tts):
    def broken(user_id, proposal_id):
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(chat_graph, "_proposal_files", broken)
    _reply(mock_api, "You need at least 10% in cash [1].")

    response = _chat(client, proposal_id="riverbend")

    assert response.status_code == 200
    assert library["calls"][0][2] == []
    assert response.json()["sources"][0]["origin"] == "library"
