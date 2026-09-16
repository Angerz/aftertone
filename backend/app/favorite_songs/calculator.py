"""Canonical calculation for the personal favorite-song ranking."""
from decimal import Decimal


def calculate_favorite_song_score(*, base_score: Decimal, emotional_connection: Decimal, replay_value: Decimal, historical_relevance: Decimal, originality: Decimal) -> Decimal:
    return base_score * Decimal("0.25") + emotional_connection + replay_value * Decimal("0.20") + historical_relevance * Decimal("0.10") + originality * Decimal("0.20")
