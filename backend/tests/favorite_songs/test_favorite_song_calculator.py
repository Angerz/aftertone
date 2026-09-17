from decimal import Decimal

import pytest

from app.favorite_songs.calculator import calculate_favorite_song_score


@pytest.mark.parametrize(("values", "expected"), [
    (("10", "5", "5", "5"), "10.00"), (("0", "0", "0", "0"), "0.00"), (("9.8", "4.5", "4.7", "4.5"), "9.26"),
])
def test_favorite_song_formula(values: tuple[str, str, str, str], expected: str) -> None:
    result = calculate_favorite_song_score(base_score=Decimal(values[0]), emotional_connection=Decimal(values[1]), replay_value=Decimal(values[2]), originality=Decimal(values[3]))
    assert result == Decimal(expected)
