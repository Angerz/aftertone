from datetime import datetime, timezone
from types import SimpleNamespace

from app.main import apply_favorite_song_rank_history, favorite_song_movement


def test_movement_uses_previous_canonical_positions() -> None:
    assert favorite_song_movement(5, 8) == ("up", 3)
    assert favorite_song_movement(7, 4) == ("down", 3)
    assert favorite_song_movement(9, 9) == ("unchanged", 0)
    assert favorite_song_movement(42, None) == ("new", 0)
    assert favorite_song_movement(101, 99) == ("unchanged", 0)


def test_rank_history_tracks_canonical_movement_and_continuous_tenure() -> None:
    entered_at = datetime(2025, 1, 1, tzinfo=timezone.utc)
    rows = [
        SimpleNamespace(id=1, previous_canonical_position=None, top_100_entered_at=entered_at),
        SimpleNamespace(id=2, previous_canonical_position=None, top_100_entered_at=None),
        SimpleNamespace(id=3, previous_canonical_position=None, top_100_entered_at=entered_at),
    ]
    now = datetime(2026, 9, 17, tzinfo=timezone.utc)

    apply_favorite_song_rank_history(rows, {1: 8, 3: 4}, now)

    assert rows[0].previous_canonical_position == 8
    assert rows[0].top_100_entered_at == entered_at  # still inside: no tenure reset
    assert rows[1].previous_canonical_position is None
    assert rows[1].top_100_entered_at == now  # candidate/new entry enters Top 100
    assert rows[2].previous_canonical_position == 4
    assert rows[2].top_100_entered_at == entered_at


def test_leaving_top_100_clears_active_tenure() -> None:
    row = SimpleNamespace(id=1, previous_canonical_position=None, top_100_entered_at=datetime(2025, 1, 1, tzinfo=timezone.utc))
    apply_favorite_song_rank_history([SimpleNamespace(id=index + 2, previous_canonical_position=None, top_100_entered_at=None) for index in range(100)] + [row], {1: 1}, datetime(2026, 9, 17, tzinfo=timezone.utc))
    assert row.previous_canonical_position == 1
    assert row.top_100_entered_at is None
