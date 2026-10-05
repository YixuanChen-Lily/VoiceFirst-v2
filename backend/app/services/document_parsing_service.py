"""Turn uploaded draft files into plain text."""

import re


def extract_text(content: bytes) -> str:
    """Attempt to decode uploaded content into text."""

    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            decoded = content.decode(encoding)
            return re.sub(r"\s+", " ", decoded)
        except UnicodeDecodeError:
            continue
    return ""
