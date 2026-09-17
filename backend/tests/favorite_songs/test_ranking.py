from decimal import Decimal
from types import SimpleNamespace

from app.main import favorite_song_sort_key


def entry(title: str, *, emotion: str = "4", replay: str = "4", base: str = "8", originality: str = "4") -> SimpleNamespace:
    return SimpleNamespace(final_score=Decimal("9.42"), emotional_connection=Decimal(emotion), replay_value=Decimal(replay), base_score=Decimal(base), originality=Decimal(originality), track=SimpleNamespace(title=title))


def ranked(*entries: SimpleNamespace) -> list[SimpleNamespace]:
    return sorted(entries, key=favorite_song_sort_key)


def test_equal_scores_use_the_specified_tie_breakers() -> None:
    assert ranked(entry("low emotion", emotion="3"), entry("high emotion", emotion="5"))[0].track.title == "high emotion"
    assert ranked(entry("low replay", replay="3"), entry("high replay", replay="5"))[0].track.title == "high replay"
    assert ranked(entry("low base", base="7"), entry("high base", base="9"))[0].track.title == "high base"
    assert ranked(entry("low originality", originality="3"), entry("high originality", originality="5"))[0].track.title == "high originality"


def test_exact_criterion_ties_use_title_and_never_change_the_displayed_score() -> None:
    rows = ranked(entry("Zulu"), entry("Alpha"))
    assert [item.track.title for item in rows] == ["Alpha", "Zulu"]
    assert [item.final_score for item in rows] == [Decimal("9.42"), Decimal("9.42")]
    assert ranked(*rows) == rows
