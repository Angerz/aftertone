from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.music import ReleaseType


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", json_encoders={Decimal: float})


T = TypeVar("T")


class PaginatedResponse(APIModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int


class TrackCreate(APIModel):
    disc_number: int = Field(default=1, ge=1, le=99)
    position: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=300)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be empty")
        return value


class ArtistCreate(APIModel):
    name: str = Field(min_length=1, max_length=300)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("must not be empty")
        return value


class ArtistResponse(APIModel):
    id: int
    name: str
    album_count: int = 0


class ArtistAlbumResponse(APIModel):
    id: int
    title: str
    year: int | None
    release_type: ReleaseType
    cover_url: str | None = None
    artists: list[ArtistResponse]
    rating: Decimal | None = None


class TrackAppearanceResponse(APIModel):
    track_id: int
    track_title: str
    album_id: int
    album_title: str
    role: str


class ArtistDetailResponse(ArtistResponse):
    albums: list[ArtistAlbumResponse]
    featured_appearances: list[TrackAppearanceResponse]


class ArtistCreditInput(APIModel):
    artist_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, max_length=300)

    @field_validator("name")
    @classmethod
    def strip_optional_name(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else None


class TrackCreditsUpdate(APIModel):
    primary_artist_ids: list[int] = Field(default_factory=list)
    featured_artist_ids: list[int] = Field(default_factory=list)


class AlbumCreate(APIModel):
    title: str = Field(min_length=1, max_length=300)
    artists: list[ArtistCreditInput] = Field(min_length=1)
    year: int | None = Field(default=None, ge=1000, le=3000)
    release_type: ReleaseType = ReleaseType.ALBUM
    disc_count: int = Field(default=1, ge=1, le=99)
    tracks: list[TrackCreate] = Field(min_length=1)

    @field_validator("title")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value

    @model_validator(mode="after")
    def validate_disc_tracks(self) -> "AlbumCreate":
        positions = [(track.disc_number, track.position) for track in self.tracks]
        if len(positions) != len(set(positions)):
            raise ValueError("track positions must be unique within each disc")
        if any(track.disc_number > self.disc_count for track in self.tracks):
            raise ValueError("track disc number must not exceed album disc count")
        return self


class TrackUpdate(APIModel):
    id: int | None = Field(default=None, ge=1)
    disc_number: int = Field(default=1, ge=1, le=99)
    title: str = Field(min_length=1, max_length=300)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be empty")
        return value


class AlbumUpdate(APIModel):
    title: str = Field(min_length=1, max_length=300)
    artists: list[ArtistCreditInput] = Field(min_length=1)
    year: int | None = Field(default=None, ge=1000, le=3000)
    release_type: ReleaseType
    disc_count: int = Field(default=1, ge=1, le=99)
    tracks: list[TrackUpdate] | None = Field(default=None, min_length=1)

    @field_validator("title")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value

    @model_validator(mode="after")
    def validate_disc_tracks(self) -> "AlbumUpdate":
        if self.tracks is not None and any(track.disc_number > self.disc_count for track in self.tracks):
            raise ValueError("track disc number must not exceed album disc count")
        return self


class CoverFromUrl(APIModel):
    url: str = Field(min_length=1, max_length=2000)

    @field_validator("url")
    @classmethod
    def strip_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value


class TrackResponse(APIModel):
    id: int
    disc_number: int
    position: int
    title: str
    primary_artists: list[ArtistResponse] = Field(default_factory=list)
    featured_artists: list[ArtistResponse] = Field(default_factory=list)
    uses_album_artists: bool = True


class LatestRevisionResponse(APIModel):
    id: int
    created_at: datetime
    pre_rating: Decimal | None
    final_rating: Decimal | None


class LegacyRatingSummaryResponse(APIModel):
    id: int
    imported_at: datetime
    legacy_final_rating: Decimal | None
    computed_final_rating: Decimal | None
    reconciliation_status: str


class AlbumResponse(APIModel):
    id: int
    title: str
    artists: list[ArtistResponse]
    year: int | None
    release_type: ReleaseType
    disc_count: int
    created_at: datetime
    tracks: list[TrackResponse]
    latest_revision: LatestRevisionResponse | None = None
    cover_url: str | None = None
    needs_revisit: bool = False
    revisit_reason: str | None = None
    revisit_marked_at: datetime | None = None
    latest_legacy_rating: LegacyRatingSummaryResponse | None = None


class AlbumFacetsResponse(APIModel):
    decades: dict[int, list[int]]


class AlbumRatingSummaryResponse(APIModel):
    average: Decimal | None
    rated_count: int


class RevisitUpdate(APIModel):
    reason: str | None = Field(default=None, max_length=5000)


class LegacyImportPreviewRowResponse(APIModel):
    row_number: int
    title: str | None
    artist: str | None
    legacy_final_rating: Decimal | None
    legacy_pre_rating: Decimal | None
    legacy_bad_experience: Decimal | None
    computed_pre_rating: Decimal | None
    computed_bad_experience: Decimal | None
    computed_final_rating: Decimal | None
    pre_formula: str | None
    extracted_score_count: int
    status: str
    warnings: list[str]
    errors: list[str]


class LegacyImportPreviewResponse(APIModel):
    rows: list[LegacyImportPreviewRowResponse]


class LegacyImportCommitResponse(APIModel):
    imported: int
    skipped: int
    failed: int


class LegacyTrackMapping(APIModel):
    legacy_score_index: int = Field(ge=0)
    track_id: int = Field(ge=1)


class LegacyReconciliationRequest(APIModel):
    track_titles: list[str] = Field(default_factory=list)
    track_mappings: list[LegacyTrackMapping]


class LegacyReconciliationResponse(APIModel):
    revision_id: int
    pre_rating: Decimal | None
    bad_experience: Decimal | None
    final_rating: Decimal | None


class LegacyReconciliationPreviewResponse(APIModel):
    pre_rating: Decimal | None
    bad_experience: Decimal | None
    final_rating: Decimal | None

class LegacyRatingDetailResponse(APIModel):
    id: int
    album_id: int
    extracted_scores: list[Decimal]
    coherence: Decimal
    emotion: Decimal
    legacy_pre_rating: Decimal | None
    legacy_bad_experience: Decimal | None
    legacy_final_rating: Decimal | None
    reconciliation_status: str


class TrackRatingRevisionCreate(APIModel):
    track_id: int = Field(ge=1)
    score: Decimal = Field(ge=Decimal("0"), le=Decimal("10"))
    include_in_pre_rating: bool = True
    notes: str | None = None


class RatingRevisionCreate(APIModel):
    coherence: Decimal = Field(ge=Decimal("0"), le=Decimal("10"))
    coherence_notes: str | None = None
    emotion: Decimal = Field(ge=Decimal("0"), le=Decimal("10"))
    emotion_notes: str | None = None
    album_notes: str | None = None
    tracks: list[TrackRatingRevisionCreate]


class TrackRatingRevisionResponse(APIModel):
    track_id: int
    title: str
    disc_number: int
    position: int
    score: Decimal | None
    include_in_pre_rating: bool
    notes: str | None


class RatingRevisionSummaryResponse(APIModel):
    id: int
    created_at: datetime
    pre_rating: Decimal | None
    coherence: Decimal
    emotion: Decimal
    bad_experience: Decimal | None
    final_rating: Decimal | None


class RatingRevisionResponse(RatingRevisionSummaryResponse):
    album_id: int
    coherence_notes: str | None
    emotion_notes: str | None
    album_notes: str | None
    tracks: list[TrackRatingRevisionResponse]
