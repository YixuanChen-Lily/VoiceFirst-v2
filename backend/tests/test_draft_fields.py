import json

import httpx

from .conftest import OPENAI_CHAT_URL, openai_completion, sent_json

DRAFT = (
    b"Willow Bend Community Greenhouse\nSubmitted by Willow Bend Food Council\n\n"
    b"Our 2025 survey of 312 households found 41% skip meals.\n\nBudget\nHeating: $9,200\nTotal: $118,200\n"
)


def _extract(client, content: bytes = DRAFT, name: str = "draft.txt"):
    return client.post("/api/proposals/extract-fields", files={"file": (name, content, "text/plain")})


def test_returns_only_the_fields_the_draft_covers(client, mock_api):
    reply = {
        "projectTitle": "  Willow Bend Community Greenhouse ",
        "organizationName": "Willow Bend Food Council",
        "supportingEvidence": "Our 2025 survey of 312 households found 41% skip meals.",
        "totalBudget": "$118,200",
        "executiveSummary": "   ",
        "budgetLines": [
            {"category": "Heating", "description": "", "amount": "$9,200"},
            {"category": " ", "description": "", "amount": ""},
        ],
        "riskRows": [],
    }
    openai = mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(json.dumps(reply)))

    response = _extract(client)

    assert response.status_code == 200
    assert response.json() == {
        "fields": {
            "projectTitle": "Willow Bend Community Greenhouse",
            "organizationName": "Willow Bend Food Council",
            "supportingEvidence": "Our 2025 survey of 312 households found 41% skip meals.",
            "totalBudget": "$118,200",
            "budgetLines": [{"category": "Heating", "description": "", "amount": "$9,200"}],
        }
    }
    sent = sent_json(openai)
    assert "never add facts" in sent["messages"][0]["content"]
    assert "312 households" in sent["messages"][1]["content"]


def test_says_so_when_the_model_call_fails(client, mock_api):
    mock_api.post(OPENAI_CHAT_URL).mock(return_value=httpx.Response(500, json={"error": {"message": "down"}}))

    response = _extract(client)

    assert response.status_code == 502
    assert response.json()["detail"] == "Couldn't read the fields from your draft. Please try again."


def test_rejects_empty_and_unreadable_files(client, mock_api):
    assert _extract(client, b"").status_code == 400
    assert _extract(client, b"   \n ").status_code == 400
    assert _extract(client, b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + bytes(64), "draft.doc").status_code == 400  # old Word
