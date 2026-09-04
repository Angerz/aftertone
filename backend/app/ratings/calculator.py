"""The only implementation of Aftertone's rating formula."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

ZERO = Decimal("0")
FIVE = Decimal("5")
SEVEN = Decimal("7")
TEN = Decimal("10")


@dataclass(frozen=True)
class TrackScore:
    score: Decimal
    include_in_pre_rating: bool = True


@dataclass(frozen=True)
class RatingResult:
    pre_rating: Decimal | None
    bad_experience: Decimal | None
    emotion_component: Decimal | None
    final_rating: Decimal | None


def _validate_score(score: Decimal, name: str) -> None:
    if not ZERO <= score <= TEN:
        raise ValueError(f"{name} must be between 0 and 10")


def calculate_rating(
    track_scores: Iterable[TrackScore], *, coherence: Decimal, emotion: Decimal
) -> RatingResult:
    """Calculate a revision. No included tracks means no meaningful final rating."""
    _validate_score(coherence, "coherence")
    _validate_score(emotion, "emotion")
    all_tracks = list(track_scores)
    for track in all_tracks:
        _validate_score(track.score, "track score")
    included = [track.score for track in all_tracks if track.include_in_pre_rating]
    if not included:
        return RatingResult(None, None, None, None)

    pre_rating = sum(included, ZERO) / Decimal(len(included))
    bad_points = sum(
        (Decimal("1") if score < FIVE else Decimal("0.5") if score < SEVEN else ZERO)
        for score in included
    )
    bad_experience = bad_points / Decimal(len(included))
    coherence_component = ((coherence / TEN) ** 2) * Decimal("0.25")
    emotion_component = ((emotion - FIVE) / Decimal("100") * Decimal("2.5"))
    if emotion > FIVE:
        emotion_component *= ONE_MINUS(bad_experience)
    final_rating = pre_rating + coherence_component - Decimal("0.5") * (bad_experience**2) + emotion_component
    return RatingResult(pre_rating, bad_experience, emotion_component, final_rating)


def ONE_MINUS(value: Decimal) -> Decimal:
    return Decimal("1") - value
