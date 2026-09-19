from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.main import apply_favorite_song_rank_history, favorite_song_movement


def row(identifier: int, entered_at: datetime | None = None) -> SimpleNamespace:
    return SimpleNamespace(id=identifier, last_rank_from=None, last_rank_to=None, last_rank_changed_at=None, top_100_entered_at=entered_at)


def test_movement_stays_with_each_song_until_that_song_moves_again() -> None:
    now = datetime(2026, 9, 10, tzinfo=timezone.utc)
    a, b, c = row(1), row(2), row(3)
    apply_favorite_song_rank_history([a, b, c], {1: 2, 2: 1, 3: 3}, now)

    assert (a.last_rank_from, a.last_rank_to) == (2, 1)
    assert (b.last_rank_from, b.last_rank_to) == (1, 2)
    assert c.last_rank_changed_at is None

    # A later change only displaces C. A and B keep their Sep 10 movements.
    later = now + timedelta(days=2)
    apply_favorite_song_rank_history([a, b, c], {1: 1, 2: 2, 3: 4}, later)
    assert (a.last_rank_from, a.last_rank_to, a.last_rank_changed_at) == (2, 1, now)
    assert (b.last_rank_from, b.last_rank_to, b.last_rank_changed_at) == (1, 2, now)
    assert (c.last_rank_from, c.last_rank_to, c.last_rank_changed_at) == (4, 3, later)


def test_movement_freshness_and_new_expire_after_30_days() -> None:
    now = datetime(2026, 9, 1, tzinfo=timezone.utc)
    up = row(1); up.last_rank_from, up.last_rank_to, up.last_rank_changed_at = 15, 14, now
    newcomer = row(2); newcomer.last_rank_from, newcomer.last_rank_to, newcomer.last_rank_changed_at = None, 20, now

    assert favorite_song_movement(up, 14, now + timedelta(days=30)) == ("up", 1)
    assert favorite_song_movement(newcomer, 20, now + timedelta(days=30)) == ("new", 0)
    assert favorite_song_movement(up, 14, now + timedelta(days=31)) == ("unchanged", 0)
    assert favorite_song_movement(newcomer, 20, now + timedelta(days=31)) == ("unchanged", 0)


def test_top_100_tenure_remains_independent_of_movement() -> None:
    entered_at = datetime(2025, 1, 1, tzinfo=timezone.utc)
    current = row(1, entered_at)
    apply_favorite_song_rank_history([current], {1: 1}, datetime(2026, 9, 17, tzinfo=timezone.utc))
    assert current.top_100_entered_at == entered_at
    assert current.last_rank_changed_at is None

    outside = row(2, entered_at)
    apply_favorite_song_rank_history([row(index + 3) for index in range(100)] + [outside], {2: 1}, datetime(2026, 9, 17, tzinfo=timezone.utc))
    assert outside.top_100_entered_at is None
