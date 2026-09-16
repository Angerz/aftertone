from decimal import Decimal

import pytest

from app.favorite_songs.calculator import calculate_favorite_song_score
from app.imports.favorite_songs_excel import ALIASES, header_key, title_key


@pytest.mark.parametrize(("values", "expected"), [
    (("10", "5", "5", "4.7", "5"), "9.97"), (("10", "5", "5", "5", "4.7"), "9.94"),
    (("10", "5", "4.7", "4.8", "4.9"), "9.90"), (("10", "5", "4.6", "4.6", "5"), "9.88"),
    (("10", "5", "4.8", "4.3", "4.8"), "9.85"), (("10", "5", "5", "4.7", "4.3"), "9.83"),
])
def test_excel_examples(values: tuple[str, str, str, str, str], expected: str) -> None:
    result = calculate_favorite_song_score(base_score=Decimal(values[0]), emotional_connection=Decimal(values[1]), replay_value=Decimal(values[2]), historical_relevance=Decimal(values[3]), originality=Decimal(values[4]))
    assert result == Decimal(expected)


def test_legacy_favorite_song_headers_match_the_expected_spanish_sheet() -> None:
    headers = ["Posición", "Canción", "Artista", "Álbum", "Año", "Género", "Puntuación", "Conexión Emocional", "Replay Value", "Rel. e Imp. Histórico", "Originalidad", "Calificación"]
    assert [ALIASES[header_key(header)] for header in headers] == ["position", "song", "artist", "album", "year", "genre", "base", "emotional", "replay", "historical", "originality", "final"]


def test_track_matching_ignores_terminal_featured_credit_suffixes_and_punctuation() -> None:
    assert title_key("Wesley's Theory (feat. George Clinton & Thundercat)") == title_key("Wesley’s Theory")
