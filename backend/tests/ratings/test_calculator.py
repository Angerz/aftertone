from decimal import Decimal

import pytest

from app.ratings.calculator import TrackScore, calculate_rating


def score(value: str, included: bool = True) -> TrackScore:
    return TrackScore(Decimal(value), included)


def test_pre_rating_averages_included_tracks_only() -> None:
    result = calculate_rating([score("10"), score("8"), score("0", False)], coherence=Decimal("0"), emotion=Decimal("5"))
    assert result.pre_rating == Decimal("9")


def test_no_included_tracks_has_no_rating() -> None:
    assert calculate_rating([score("8", False)], coherence=Decimal("5"), emotion=Decimal("5")).final_rating is None


@pytest.mark.parametrize(
    ("tracks", "expected"),
    [([score("4.9")], "1"), ([score("5")], "0.5"), ([score("6.9")], "0.5"), ([score("7")], "0"), ([score("4"), score("6"), score("8")], "0.5")],
)
def test_bad_experience_thresholds(tracks: list[TrackScore], expected: str) -> None:
    assert calculate_rating(tracks, coherence=Decimal("0"), emotion=Decimal("5")).bad_experience == Decimal(expected)


def test_bad_experience_extremes() -> None:
    assert calculate_rating([score("10")], coherence=Decimal("0"), emotion=Decimal("5")).bad_experience == Decimal("0")
    assert calculate_rating([score("0")], coherence=Decimal("0"), emotion=Decimal("5")).bad_experience == Decimal("1")


def test_bad_experience_does_not_reduce_negative_emotion_penalty() -> None:
    clean = calculate_rating([score("10")], coherence=Decimal("0"), emotion=Decimal("3"))
    bad = calculate_rating([score("0")], coherence=Decimal("0"), emotion=Decimal("3"))
    assert clean.emotion_component == bad.emotion_component == Decimal("-0.05")


def test_bad_experience_reduces_positive_emotion_bonus() -> None:
    clean = calculate_rating([score("10")], coherence=Decimal("0"), emotion=Decimal("10"))
    bad = calculate_rating([score("0")], coherence=Decimal("0"), emotion=Decimal("10"))
    assert clean.emotion_component == Decimal("0.125")
    assert bad.emotion_component == Decimal("0")


def test_known_grace_formula() -> None:
    result = calculate_rating([score("9.954545455")], coherence=Decimal("7"), emotion=Decimal("10"))
    assert result.final_rating == pytest.approx(Decimal("10.202045455"))


def test_known_tpab_formula() -> None:
    result = calculate_rating([score("9.8625")], coherence=Decimal("10"), emotion=Decimal("8.5"))
    assert result.final_rating == pytest.approx(Decimal("10.2"))

