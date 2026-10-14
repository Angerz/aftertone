"""The only implementation of Aftertone's rating formula."""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

ZERO = Decimal("0")
FIVE = Decimal("5")
SEVEN = Decimal("7")
TEN = Decimal("10")


@dataclass(frozen=True)
class TrackScore:
    score: Decimal | None
    include_in_pre_rating: bool = True


@dataclass(frozen=True)
class RatingResult:
    pre_rating: Decimal | None
    bad_experience: Decimal | None
    emotion_component: Decimal | None
    final_rating: Decimal | None


@dataclass(frozen=True)
class RatingBreakdown:
    pre_contribution: Decimal | None
    coherence_contribution: Decimal | None
    bad_experience_contribution: Decimal | None
    emotion_contribution: Decimal | None
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
        if track.score is not None:
            _validate_score(track.score, "track score")
        elif track.include_in_pre_rating:
            raise ValueError("an included track score is required")
    included = [
        track.score
        for track in all_tracks
        if track.include_in_pre_rating and track.score is not None
    ]
    if not included:
        return RatingResult(None, None, None, None)

    pre_rating = sum(included, ZERO) / Decimal(len(included))
    bad_points = sum(
        (Decimal("1") if score < FIVE else Decimal("0.5") if score < SEVEN else ZERO)
        for score in included
    )
    bad_experience = bad_points / Decimal(len(included))
    breakdown = calculate_rating_breakdown(
        pre_rating=pre_rating, bad_experience=bad_experience, coherence=coherence, emotion=emotion
    )
    return RatingResult(
        pre_rating, bad_experience, breakdown.emotion_contribution, breakdown.final_rating
    )


def calculate_rating_breakdown(
    *,
    pre_rating: Decimal | None,
    bad_experience: Decimal | None,
    coherence: Decimal,
    emotion: Decimal,
) -> RatingBreakdown:
    """Return the exact formula terms used to produce an already-snapshotted rating."""
    if pre_rating is None or bad_experience is None:
        return RatingBreakdown(None, None, None, None, None)
    coherence_contribution = ((coherence / TEN) ** 2) * Decimal("0.25")
    bad_experience_contribution = -Decimal("0.5") * (bad_experience**2)
    emotion_contribution = (emotion - FIVE) / Decimal("100") * Decimal("2.5")
    if emotion > FIVE:
        emotion_contribution *= ONE_MINUS(bad_experience)
    final_rating = (
        pre_rating + coherence_contribution + bad_experience_contribution + emotion_contribution
    )
    return RatingBreakdown(
        pre_rating,
        coherence_contribution,
        bad_experience_contribution,
        emotion_contribution,
        final_rating,
    )


def ONE_MINUS(value: Decimal) -> Decimal:
    return Decimal("1") - value
