"""Each chunk starts with a label naming its document and the section(s) it covers."""

from backend.app.clients.document_store import DocumentRecord, utc_now
from backend.app.services.knowledge_service import _is_heading, split_into_chunks

from .test_document_parsing import make_pdf


def _record(title: str = "Program Guide.pdf") -> DocumentRecord:
    return DocumentRecord(
        id="doc-1", scope="library", proposal_id=None, owner_id="user-1", title=title,
        filename=title, content_type="text/plain", kind=None, doc_type=None, funder=None,
        storage_path="x", size_bytes=1, status="processing", error=None, chunk_count=0,
        created_at=utc_now(),
    )


def test_heading_detection():
    for heading in ("Project approval criteria", "5.2 Cost sharing", "Eligible recipients"):
        assert _is_heading(heading), heading
    for not_heading in (
        "The applicant must contribute a minimum 10% cash contribution.",
        "Ineligible expenditures include:",
        "- the applicant must contribute cash",
        "| up to 80%",
        "Source: https://example.gc.ca/page",
        "Email: someone@example.ca",
        "lowercase start is not a heading",
        "A very long line that goes on for far more than ten words is body text not a heading",
    ):
        assert not _is_heading(not_heading), not_heading


def test_a_list_cut_away_from_its_heading_still_carries_it():
    text = (
        "Project approval criteria\n\n"
        + "\n".join(f"- criterion number {n} is described here in a few words" for n in range(8))
        + "\n- the applicant must contribute a minimum 10% cash contribution\n\n"
        "Funding levels\n\nFunding is limited to the gap."
    ).encode()

    chunks = split_into_chunks(_record("CORP Guidelines.txt"), text)[1]
    cash = next(chunk for chunk in chunks if "10% cash" in chunk.page_content)

    assert cash.page_content.startswith("CORP Guidelines › Project approval criteria\n\n- ")
    assert cash.metadata["section"].startswith("Project approval criteria")
    funding = next(chunk for chunk in chunks if "limited to the gap" in chunk.page_content)
    assert "Funding levels" in funding.page_content.split("\n\n", 1)[0]


def test_a_chunk_that_crosses_into_a_new_section_names_both():
    text = b"Eligibility\n\nOnly communities may apply.\n\nBudget rules\n\nUp to 75 percent is covered."

    (chunk,) = split_into_chunks(_record("Guide.txt"), text)[1]

    assert chunk.page_content.split("\n\n", 1)[0] == "Guide › Eligibility / Budget rules"


def test_pdf_sections_carry_over_to_the_next_page():
    pdf = make_pdf("Eligible costs", "Salaries and travel are covered.")

    chunks = split_into_chunks(_record("Guide.pdf"), pdf)[1]

    assert [chunk.metadata["page"] for chunk in chunks] == [1, 2]
    assert chunks[1].page_content == "Guide › Eligible costs\n\nSalaries and travel are covered."


def test_a_document_with_no_headings_is_labelled_with_its_title():
    (chunk,) = split_into_chunks(_record("notes.txt"), b"just some lowercase notes, nothing more.")[1]

    assert chunk.page_content == "notes\n\njust some lowercase notes, nothing more."
    assert chunk.metadata["section"] is None
