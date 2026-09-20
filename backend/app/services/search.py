"""Search-only text normalization shared across local catalogue surfaces."""
from __future__ import annotations

import unicodedata


_APOSTROPHES = str.maketrans({"'": "", "’": "", "‘": "", "`": ""})


def normalize_search_text(value: str) -> str:
    """Fold accents and common apostrophes without changing stored display text."""
    collapsed = " ".join(value.strip().split()).casefold().translate(_APOSTROPHES)
    decomposed = unicodedata.normalize("NFD", collapsed)
    return "".join(character for character in decomposed if not unicodedata.combining(character))
