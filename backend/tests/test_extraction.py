"""The per-section reply shapes built for structured output."""

from backend.app.services import extraction_service
from backend.app.services.extraction_service import FIELD_DESCRIPTIONS, SECTION_FIELD_CONFIG


def test_every_fillable_field_has_a_description():
    fields = {name for config in SECTION_FIELD_CONFIG.values() for name in config["fields"]}

    assert fields <= set(FIELD_DESCRIPTIONS)
    assert all(FIELD_DESCRIPTIONS[name].strip() for name in fields)


def test_each_section_gets_a_model_with_exactly_its_fields():
    for section, config in SECTION_FIELD_CONFIG.items():
        turn_model = extraction_service.build_turn_model(section)
        fields_model = turn_model.model_fields["field_updates"].annotation

        assert set(turn_model.model_fields) == {"chat_reply", "field_updates"}
        assert list(fields_model.model_fields) == config["fields"]
        assert all(field.description for field in fields_model.model_fields.values())


def test_sections_without_fields_have_no_model():
    assert extraction_service.build_turn_model(None) is None
    assert extraction_service.build_turn_model(11) is None
    assert extraction_service.build_extraction_instruction(11) is None


def test_reply_is_validated_and_empty_fields_are_dropped():
    turn_model = extraction_service.build_turn_model(1)

    turn = turn_model.model_validate(
        {
            "chat_reply": "Got it.",
            "field_updates": {"projectTitle": "  Riverbend Youth Hub ", "contactName": "", "contactEmail": None},
        }
    )

    assert turn.chat_reply == "Got it."
    assert extraction_service.to_field_updates(turn.field_updates) == {"projectTitle": "Riverbend Youth Hub"}
    assert extraction_service.to_field_updates(turn_model.model_validate({"chat_reply": "Hi", "field_updates": {}}).field_updates) is None
