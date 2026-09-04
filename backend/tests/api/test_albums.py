from __future__ import annotations

import os
import shutil
import tempfile
from io import BytesIO
from decimal import Decimal
from pathlib import Path

os.environ["AFTERTONE_DATABASE_URL"] = f"sqlite:///{Path(__file__).parent / 'aftertone-api-test.sqlite3'}"
TEST_COVER_DIR = Path(tempfile.mkdtemp(prefix="aftertone-cover-test-"))
os.environ["AFTERTONE_COVER_DIR"] = str(TEST_COVER_DIR)

import pytest
from sqlalchemy import select
from fastapi import HTTPException, UploadFile
from PIL import Image
from pydantic import ValidationError
from starlette.datastructures import Headers

from app.config import cover_dir
from app.database import Base, SessionLocal, engine
from app.imports.legacy_excel import commit_rows, preview_workbook
from app.imports.pre_formula import PreFormulaError, parse_pre_formula
from app.main import clear_revisit_mark, create_album, create_revision, delete_cover, get_album, get_revision, list_albums, list_revisions, mark_for_revisit, upload_cover
from app.ratings.calculator import TrackScore, calculate_rating
from app.models.music import Album, LegacyRating, Track
from app.schemas.music import AlbumCreate, LegacyReconciliationRequest, LegacyTrackMapping, RatingRevisionCreate, RevisitUpdate
from app.services.legacy_reconciliation import ReconciliationError, reconcile_legacy_rating


@pytest.fixture(autouse=True)
def database() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    shutil.rmtree(TEST_COVER_DIR, ignore_errors=True)
    TEST_COVER_DIR.mkdir()
    yield
    Base.metadata.drop_all(engine)
    shutil.rmtree(TEST_COVER_DIR, ignore_errors=True)


def album_payload(title: str = "Grace") -> dict[str, object]:
    return {
        "title": title, "artist": "Jeff Buckley", "year": 1994, "release_type": "album",
        "tracks": [{"position": 2, "title": "Grace"}, {"position": 1, "title": "Mojo Pin"}],
    }


def create_test_album(title: str = "Grace"):
    with SessionLocal() as session:
        return create_album(AlbumCreate.model_validate(album_payload(title)), session)


def revision_payload(album) -> dict[str, object]:
    return {
        "coherence": "7", "coherence_notes": "Cohesive sequencing.", "emotion": "10",
        "emotion_notes": "Overwhelming.", "album_notes": "A complete note.",
        "tracks": [
            {"track_id": album.tracks[0].id, "score": "10", "include_in_pre_rating": True, "notes": "Opener."},
            {"track_id": album.tracks[1].id, "score": "9", "include_in_pre_rating": False, "notes": "Title track."},
        ],
    }


def image_upload(image_format: str = "PNG", content_type: str = "image/png") -> UploadFile:
    data = BytesIO()
    Image.new("RGB", (1600, 800), color="navy").save(data, format=image_format)
    data.seek(0)
    return UploadFile(file=data, filename=f"cover.{image_format.lower()}", headers=Headers({"content-type": content_type}))


def test_create_get_and_list_albums_with_ordered_tracks() -> None:
    created = create_test_album()
    assert [track.position for track in created.tracks] == [1, 2]
    assert created.year == 1994
    with SessionLocal() as session:
        found = get_album(created.id, session)
        assert [track.title for track in found.tracks] == ["Mojo Pin", "Grace"]
        listed = list_albums(session)
        assert [album.id for album in listed] == [created.id]
        assert listed[0].latest_revision is None


def test_album_list_includes_only_the_latest_revision_summary() -> None:
    album = create_test_album()
    first_payload = RatingRevisionCreate.model_validate(revision_payload(album))
    with SessionLocal() as session:
        first = create_revision(album.id, first_payload, session)
    second_data = revision_payload(album)
    second_data["emotion"] = "5"
    with SessionLocal() as session:
        second = create_revision(album.id, RatingRevisionCreate.model_validate(second_data), session)
        latest = list_albums(session)[0].latest_revision
    assert latest is not None
    assert latest.id == second.id
    assert latest.id != first.id
    assert latest.pre_rating == second.pre_rating
    assert latest.final_rating == second.final_rating


def test_create_and_read_complete_calculated_revision() -> None:
    album = create_test_album()
    payload = RatingRevisionCreate.model_validate(revision_payload(album))
    with SessionLocal() as session:
        revision = create_revision(album.id, payload, session)
        expected = calculate_rating([TrackScore(Decimal("10"), True), TrackScore(Decimal("9"), False)],
                                    coherence=Decimal("7"), emotion=Decimal("10"))
        assert revision.pre_rating == expected.pre_rating
        assert revision.bad_experience == expected.bad_experience
        assert revision.final_rating == expected.final_rating
        assert revision.album_notes == "A complete note."
        assert revision.coherence_notes == "Cohesive sequencing."
        assert revision.emotion_notes == "Overwhelming."
        assert revision.tracks[0].notes == "Opener."
        assert revision.tracks[1].include_in_pre_rating is False
    with SessionLocal() as session:
        fetched = get_revision(album.id, revision.id, session)
        assert fetched == revision
        assert list_revisions(album.id, session)[0].id == revision.id

    no_pre_payload = revision_payload(album)
    for track in no_pre_payload["tracks"]:
        track["include_in_pre_rating"] = False
    with SessionLocal() as session:
        no_pre_revision = create_revision(album.id, RatingRevisionCreate.model_validate(no_pre_payload), session)
        assert no_pre_revision.id != revision.id
        assert no_pre_revision.pre_rating is None
        assert no_pre_revision.bad_experience is None
        assert no_pre_revision.final_rating is None
        assert len(list_revisions(album.id, session)) == 2


@pytest.mark.parametrize(("field", "value"), [("coherence", "10.1"), ("coherence", "-0.1"),
                                                   ("emotion", "10.1"), ("emotion", "-0.1")])
def test_revision_rejects_out_of_range_album_scores(field: str, value: str) -> None:
    album = create_test_album()
    payload = revision_payload(album)
    payload[field] = value
    with pytest.raises(ValidationError):
        RatingRevisionCreate.model_validate(payload)


def test_revision_rejects_client_supplied_calculated_value() -> None:
    payload = revision_payload(create_test_album())
    payload["bad_experience"] = "1"
    with pytest.raises(ValidationError):
        RatingRevisionCreate.model_validate(payload)


def test_revision_validates_complete_unique_album_tracklist() -> None:
    album = create_test_album()
    other_album = create_test_album("Sketches")
    payload = revision_payload(album)
    payload["tracks"][0]["score"] = "10.1"
    with pytest.raises(ValidationError):
        RatingRevisionCreate.model_validate(payload)
    payload["tracks"][0]["score"] = "10"
    payload["tracks"].append(payload["tracks"][0].copy())
    with SessionLocal() as session, pytest.raises(HTTPException) as duplicate:
        create_revision(album.id, RatingRevisionCreate.model_validate(payload), session)
    assert duplicate.value.status_code == 422
    payload["tracks"].pop()
    payload["tracks"][1]["track_id"] = 99999
    with SessionLocal() as session, pytest.raises(HTTPException) as nonexistent:
        create_revision(album.id, RatingRevisionCreate.model_validate(payload), session)
    assert nonexistent.value.status_code == 422
    payload["tracks"][1]["track_id"] = other_album.tracks[0].id
    with SessionLocal() as session, pytest.raises(HTTPException) as foreign:
        create_revision(album.id, RatingRevisionCreate.model_validate(payload), session)
    assert foreign.value.status_code == 422
    payload["tracks"] = payload["tracks"][:1]
    with SessionLocal() as session, pytest.raises(HTTPException) as incomplete:
        create_revision(album.id, RatingRevisionCreate.model_validate(payload), session)
    assert incomplete.value.status_code == 422


def test_revision_and_album_not_found_or_mismatched_path() -> None:
    with SessionLocal() as session, pytest.raises(HTTPException) as missing_album:
        get_album(404, session)
    assert missing_album.value.status_code == 404
    album = create_test_album()
    with SessionLocal() as session:
        revision = create_revision(album.id, RatingRevisionCreate.model_validate(revision_payload(album)), session)
    other_album = create_test_album("Sketches")
    with SessionLocal() as session, pytest.raises(HTTPException) as wrong_album:
        get_revision(other_album.id, revision.id, session)
    assert wrong_album.value.status_code == 404


@pytest.mark.parametrize(("image_format", "content_type"), [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")])
def test_upload_cover_normalizes_supported_images(image_format: str, content_type: str) -> None:
    album = create_test_album()
    with SessionLocal() as session:
        response = upload_cover(album.id, image_upload(image_format, content_type), session)
    assert response.cover_url is not None
    filename = response.cover_url.rsplit("/", 1)[-1]
    assert filename.endswith(".webp")
    assert (cover_dir() / filename).is_file()
    with Image.open(cover_dir() / filename) as stored:
        assert stored.format == "WEBP"
        assert max(stored.size) <= 1200


def test_cover_upload_rejects_invalid_content_and_missing_album() -> None:
    album = create_test_album()
    invalid_type = UploadFile(file=BytesIO(b"not an image"), filename="cover.txt", headers=Headers({"content-type": "text/plain"}))
    with SessionLocal() as session, pytest.raises(HTTPException) as invalid:
        upload_cover(album.id, invalid_type, session)
    assert invalid.value.status_code == 422
    corrupt_image = UploadFile(file=BytesIO(b"not an image"), filename="cover.png", headers=Headers({"content-type": "image/png"}))
    with SessionLocal() as session, pytest.raises(HTTPException) as corrupt:
        upload_cover(album.id, corrupt_image, session)
    assert corrupt.value.status_code == 422
    with SessionLocal() as session, pytest.raises(HTTPException) as missing:
        upload_cover(99999, image_upload(), session)
    assert missing.value.status_code == 404


def test_cover_upload_rejects_oversized_file() -> None:
    album = create_test_album()
    oversized = UploadFile(
        file=BytesIO(b"x" * (10 * 1024 * 1024 + 1)), filename="cover.png", headers=Headers({"content-type": "image/png"})
    )
    with SessionLocal() as session, pytest.raises(HTTPException) as error:
        upload_cover(album.id, oversized, session)
    assert error.value.status_code == 413


def test_replace_and_delete_cover_removes_old_file() -> None:
    album = create_test_album()
    with SessionLocal() as session:
        first = upload_cover(album.id, image_upload(), session)
        first_filename = first.cover_url.rsplit("/", 1)[-1] if first.cover_url else ""
    with SessionLocal() as session:
        second = upload_cover(album.id, image_upload("JPEG", "image/jpeg"), session)
        second_filename = second.cover_url.rsplit("/", 1)[-1] if second.cover_url else ""
    assert not (cover_dir() / first_filename).exists()
    assert (cover_dir() / second_filename).is_file()
    with SessionLocal() as session:
        deleted = delete_cover(album.id, session)
    assert deleted.cover_url is None
    assert not (cover_dir() / second_filename).exists()
    with SessionLocal() as session:
        assert delete_cover(album.id, session).cover_url is None


def test_legacy_pre_formula_parses_decimal_comma_and_audits_grace() -> None:
    scores, denominator = parse_pre_formula("=(10+10+10+10+10+10+10+10+9,5+10+10)/11")
    assert denominator == 11
    assert scores[8] == Decimal("9.5")
    assert len(scores) == 11
    with pytest.raises(PreFormulaError):
        parse_pre_formula("=AVERAGE(10,9)")


def test_legacy_preview_marks_audit_discrepancies_as_warnings() -> None:
    from openpyxl import Workbook

    workbook = Workbook(); sheet = workbook.active
    sheet.append(["ÁLBUM", "ARTISTA", "AÑO", "CALIFICACIÓN", None, "PRE-CALIFICACIÓN", "COHERENCIA", "MALA EXP", "EMOCIÓN"])
    sheet.append(["Grace", "Jeff Buckley", 1994, 1, None, "=(10+9,5+10)/3", 7, 0, 10])
    data = BytesIO(); workbook.save(data)
    with SessionLocal() as session:
        preview = preview_workbook(data.getvalue(), session)
    assert preview[0].status == "warning"
    assert preview[0].computed_pre_rating == Decimal("9.833333333333333333333333333")
    assert any("final rating differs" in warning for warning in preview[0].warnings)


def test_legacy_commit_creates_no_tracks_or_rating_revision() -> None:
    from openpyxl import Workbook

    workbook = Workbook(); sheet = workbook.active
    sheet.append(["ÁLBUM", "ARTISTA", "PRE-CALIFICACIÓN", "COHERENCIA", "EMOCIÓN"])
    sheet.append(["Legacy Album", "Legacy Artist", "=(10+9.5)/2", 7, 8])
    data = BytesIO(); workbook.save(data)
    with SessionLocal() as session:
        rows = preview_workbook(data.getvalue(), session)
        imported, skipped, failed = commit_rows(rows, {2}, session)
        legacy = session.scalar(select(LegacyRating))
        album = session.get(Album, legacy.album_id) if legacy else None
        track_count = len(album.tracks) if album else None
        revision_count = len(album.revisions) if album else None
    assert (imported, skipped, failed) == (1, 0, 0)
    assert legacy is not None
    assert legacy.extracted_scores == ["10", "9.5"]
    assert album is not None
    assert track_count == 0
    assert revision_count == 0


def test_revisit_mark_is_current_album_state_and_survives_new_revision() -> None:
    album = create_test_album()
    with SessionLocal() as session:
        marked = mark_for_revisit(album.id, RevisitUpdate(reason="Revisit after release hype."), session)
    assert marked.needs_revisit is True
    assert marked.revisit_reason == "Revisit after release hype."
    assert marked.revisit_marked_at is not None
    with SessionLocal() as session:
        create_revision(album.id, RatingRevisionCreate.model_validate(revision_payload(album)), session)
        assert get_album(album.id, session).needs_revisit is True
        cleared = clear_revisit_mark(album.id, session)
    assert cleared.needs_revisit is False
    assert cleared.revisit_reason is None


def test_legacy_reconciliation_requires_explicit_unique_mapping_and_preserves_unrated_tracks() -> None:
    album = create_test_album()
    with SessionLocal() as session:
        third_track = Track(album_id=album.id, position=3, title="Last Goodbye")
        legacy = LegacyRating(
            album_id=album.id, coherence=Decimal("7"), emotion=Decimal("8"),
            extracted_scores=["10", "9.5"], pre_formula="=(10+9.5)/2",
        )
        session.add_all([third_track, legacy])
        session.commit()
        session.refresh(legacy)
        session.refresh(third_track)

        payload = LegacyReconciliationRequest(
            track_mappings=[
                LegacyTrackMapping(legacy_score_index=0, track_id=album.tracks[0].id),
                LegacyTrackMapping(legacy_score_index=1, track_id=album.tracks[1].id),
            ]
        )
        revision = reconcile_legacy_rating(session, legacy, payload)
        session.commit()
        session.refresh(legacy)
        session.refresh(revision)

        assert legacy.reconciliation_status == "reconciled"
        assert legacy.reconciled_revision_id == revision.id
        snapshots = {item.track_id: item for item in revision.track_ratings}
        assert snapshots[album.tracks[0].id].score == Decimal("10")
        assert snapshots[album.tracks[0].id].include_in_pre_rating is True
        assert snapshots[third_track.id].score is None
        assert snapshots[third_track.id].include_in_pre_rating is False
        with pytest.raises(ReconciliationError):
            reconcile_legacy_rating(session, legacy, payload)


def test_legacy_reconciliation_rejects_duplicate_track_or_missing_score_mapping() -> None:
    album = create_test_album()
    with SessionLocal() as session:
        legacy = LegacyRating(
            album_id=album.id, coherence=Decimal("7"), emotion=Decimal("8"),
            extracted_scores=["10", "9"], pre_formula="=(10+9)/2",
        )
        session.add(legacy)
        session.commit()
        session.refresh(legacy)
        duplicate_track = LegacyReconciliationRequest(
            track_mappings=[
                LegacyTrackMapping(legacy_score_index=0, track_id=album.tracks[0].id),
                LegacyTrackMapping(legacy_score_index=1, track_id=album.tracks[0].id),
            ]
        )
        with pytest.raises(ReconciliationError, match="at most one"):
            reconcile_legacy_rating(session, legacy, duplicate_track)
        missing_score = LegacyReconciliationRequest(
            track_mappings=[LegacyTrackMapping(legacy_score_index=0, track_id=album.tracks[0].id)]
        )
        with pytest.raises(ReconciliationError, match="every legacy score"):
            reconcile_legacy_rating(session, legacy, missing_score)
        assert legacy.reconciliation_status == "pending"
