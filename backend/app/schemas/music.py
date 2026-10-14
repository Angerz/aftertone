from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal as DomainDecimal
from typing import Annotated, ClassVar, Generic, Literal, TypeVar

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    field_validator,
    model_serializer,
    model_validator,
)

from app.auth import owner_context
from app.models.music import ArtistType, ReleaseType

Decimal = Annotated[DomainDecimal, PlainSerializer(float, when_used="json")]


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    _public_fields: ClassVar[frozenset[str] | None] = None

    @model_serializer(mode="wrap")
    def public_fields(self, handler):
        data = handler(self)
        if not owner_context.get():
            for key in data:
                if (
                    key == "notes"
                    or key.endswith("_notes")
                    or key in {"revisit_reason", "revisit_marked_at"}
                ):
                    data[key] = None
                elif key == "needs_revisit":
                    data[key] = False
            if self._public_fields is not None:
                data = {key: value for key, value in data.items() if key in self._public_fields}
        return data


T = TypeVar("T")


class PaginatedResponse(APIModel, Generic[T]):
    _public_fields = frozenset({"items", "page", "page_size", "total", "total_pages"})
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


class ArtistUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    is_active: bool | None = None
    artist_type: ArtistType | None = None
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    birth_date: date | None = None
    death_date: date | None = None
    formed_year: int | None = Field(default=None, ge=1, le=9999)
    dissolved_year: int | None = Field(default=None, ge=1, le=9999)

    @field_validator("name")
    @classmethod
    def strip_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        if not value:
            raise ValueError("must not be empty")
        return value

    @field_validator("country_code")
    @classmethod
    def normalize_country_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        if len(value) != 2 or not value.isalpha():
            raise ValueError("must be a two-letter ISO country code")
        return value

    @model_validator(mode="after")
    def name_must_not_be_null_when_supplied(self) -> ArtistUpdate:
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name must not be null")
        return self


class ArtistResponse(APIModel):
    _public_fields = frozenset(
        {
            "id",
            "name",
            "artist_type",
            "country_code",
            "birth_date",
            "death_date",
            "formed_year",
            "dissolved_year",
            "image_url",
            "album_count",
            "primary_track_count",
            "featured_track_count",
            "project_counts",
            "average_rating",
            "rated_project_count",
        }
    )
    id: int
    name: str
    normalized_name: str | None = None
    is_active: bool = True
    artist_type: ArtistType = ArtistType.UNKNOWN
    country_code: str | None = None
    birth_date: date | None = None
    death_date: date | None = None
    formed_year: int | None = None
    dissolved_year: int | None = None
    image_url: str | None = None
    album_count: int = 0
    primary_track_count: int = 0
    featured_track_count: int = 0
    is_unused: bool = False
    project_counts: dict[ReleaseType, int] = Field(default_factory=dict)
    average_rating: Decimal | None = None
    rated_project_count: int = 0


class ArtistAlbumResponse(APIModel):
    _public_fields = frozenset(
        {"id", "title", "year", "release_date", "release_type", "cover_url", "artists", "rating"}
    )
    id: int
    title: str
    year: int | None
    release_date: date | None = None
    release_type: ReleaseType
    cover_url: str | None = None
    artists: list[ArtistResponse]
    rating: Decimal | None = None


class TrackAppearanceResponse(APIModel):
    _public_fields = frozenset(
        {
            "track_id",
            "track_title",
            "track_position",
            "album_id",
            "album_title",
            "album_year",
            "album_release_type",
            "album_cover_url",
            "score",
            "role",
        }
    )
    track_id: int
    track_title: str
    track_position: int
    album_id: int
    album_title: str
    album_year: int | None
    album_release_type: ReleaseType
    album_cover_url: str | None = None
    score: Decimal | None = None
    role: str


class ArtistTrackResponse(APIModel):
    _public_fields = frozenset(
        {
            "track_id",
            "title",
            "disc_number",
            "track_position",
            "score",
            "album_id",
            "album_title",
            "album_year",
            "album_release_date",
            "album_cover_url",
        }
    )
    track_id: int
    title: str
    disc_number: int
    track_position: int
    score: Decimal | None = None
    album_id: int
    album_title: str
    album_year: int | None
    album_release_date: date | None = None
    album_cover_url: str | None = None


class ArtistDetailResponse(ArtistResponse):
    _public_fields = ArtistResponse._public_fields | {"albums", "featured_appearances"}
    albums: list[ArtistAlbumResponse]
    featured_appearances: list[TrackAppearanceResponse]


class ArtistCreditInput(APIModel):
    artist_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, max_length=300)

    @field_validator("name")
    @classmethod
    def strip_optional_name(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else None


class MusicBrainzSearchResult(APIModel):
    musicbrainz_release_id: str
    musicbrainz_release_group_id: str | None = None
    title: str
    artists: list[str]
    date: str | None = None
    year: int | None = None
    country: str | None = None
    release_type: str | None = None
    disc_count: int = 1
    track_count: int = 0
    disambiguation: str | None = None


class MusicBrainzArtistSearchResult(APIModel):
    musicbrainz_artist_id: str
    name: str
    artist_type: ArtistType | None = None
    country_code: str | None = None
    disambiguation: str | None = None
    life_span_begin: str | None = None
    life_span_end: str | None = None


class MusicBrainzArtistPreview(MusicBrainzArtistSearchResult):
    birth_date: date | None = None
    death_date: date | None = None
    formed_year: int | None = None
    dissolved_year: int | None = None


class MusicBrainzTrackPreview(APIModel):
    disc_number: int = Field(ge=1, le=99)
    position: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=300)
    primary_artists: list[str] = Field(default_factory=list)


class MusicBrainzReleasePreview(APIModel):
    musicbrainz_release_id: str
    title: str
    artists: list[str]
    year: int | None = Field(default=None, ge=1000, le=3000)
    release_date: date | None = None
    release_type: ReleaseType
    source_release_type: str | None = None
    disc_count: int = Field(ge=1, le=99)
    tracks: list[MusicBrainzTrackPreview] = Field(min_length=1)
    cover_url: str | None = None


class MusicBrainzImportRequest(APIModel):
    musicbrainz_release_id: str = Field(min_length=1, max_length=36)
    title: str = Field(min_length=1, max_length=300)
    artists: list[ArtistCreditInput] = Field(min_length=1)
    year: int | None = Field(default=None, ge=1000, le=3000)
    release_date: date | None = None
    release_type: ReleaseType = ReleaseType.ALBUM
    disc_count: int = Field(ge=1, le=99)
    tracks: list[MusicBrainzTrackPreview] = Field(min_length=1)
    cover_url: str | None = None

    @model_validator(mode="after")
    def synchronize_release_year(self) -> MusicBrainzImportRequest:
        if self.release_date is not None:
            if self.year is not None and self.year != self.release_date.year:
                raise ValueError("year must match release date")
            self.year = self.release_date.year
        return self


class TrackCreditsUpdate(APIModel):
    primary_artist_ids: list[int] = Field(default_factory=list)
    featured_artist_ids: list[int] = Field(default_factory=list)


class AlbumCreate(APIModel):
    title: str = Field(min_length=1, max_length=300)
    artists: list[ArtistCreditInput] = Field(min_length=1)
    year: int | None = Field(default=None, ge=1000, le=3000)
    release_date: date | None = None
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
    def validate_disc_tracks(self) -> AlbumCreate:
        if self.release_date is not None:
            if self.year is not None and self.year != self.release_date.year:
                raise ValueError("year must match release date")
            self.year = self.release_date.year
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
    release_date: date | None = None
    release_type: ReleaseType
    disc_count: int = Field(default=1, ge=1, le=99)
    tracks: list[TrackUpdate] | None = Field(default=None, min_length=1)
    musicbrainz_release_id: str | None = Field(default=None, min_length=1, max_length=36)

    @field_validator("title")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value

    @model_validator(mode="after")
    def validate_disc_tracks(self) -> AlbumUpdate:
        if self.release_date is not None:
            if self.year is not None and self.year != self.release_date.year:
                raise ValueError("year must match release date")
            self.year = self.release_date.year
        if self.tracks is not None and any(
            track.disc_number > self.disc_count for track in self.tracks
        ):
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
    _public_fields = frozenset(
        {
            "id",
            "disc_number",
            "position",
            "title",
            "primary_artists",
            "featured_artists",
            "uses_album_artists",
        }
    )
    id: int
    disc_number: int
    position: int
    title: str
    primary_artists: list[ArtistResponse] = Field(default_factory=list)
    featured_artists: list[ArtistResponse] = Field(default_factory=list)
    uses_album_artists: bool = True


class FavoriteSongEntryWrite(APIModel):
    track_id: int = Field(ge=1)
    base_score: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("10"))
    emotional_connection: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("5"))
    replay_value: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("5"))
    originality: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("5"))
    genre: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class FavoriteSongEntryUpdate(APIModel):
    base_score: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("10"))
    emotional_connection: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("5"))
    replay_value: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("5"))
    originality: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("5"))
    genre: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class FavoriteSongEntryResponse(APIModel):
    _public_fields = frozenset(
        {
            "id",
            "global_position",
            "track_id",
            "track_title",
            "artists",
            "album_id",
            "album_title",
            "album_year",
            "cover_url",
            "disc_number",
            "track_position",
            "base_score",
            "emotional_connection",
            "replay_value",
            "originality",
            "genre",
            "notes",
            "final_score",
            "rank_movement",
            "rank_delta",
            "top_100_entered_at",
        }
    )
    id: int
    global_position: int
    track_id: int
    track_title: str
    artists: list[ArtistResponse]
    album_id: int
    album_title: str
    album_year: int | None
    cover_url: str | None
    disc_number: int
    track_position: int
    base_score: Decimal
    emotional_connection: Decimal
    replay_value: Decimal
    originality: Decimal
    genre: str | None
    notes: str | None
    final_score: Decimal
    rank_movement: Literal["unchanged", "up", "down", "new"]
    rank_delta: int
    top_100_entered_at: datetime | None


class FavoriteSongTrackSearchResponse(APIModel):
    track_id: int
    track_title: str
    artists: list[ArtistResponse]
    album_id: int
    album_title: str
    album_year: int | None
    cover_url: str | None
    latest_track_score: Decimal | None
    already_ranked_position: int | None


class LatestRevisionResponse(APIModel):
    _public_fields = frozenset({"id", "created_at", "pre_rating", "final_rating"})
    id: int
    created_at: datetime
    pre_rating: Decimal | None
    final_rating: Decimal | None


class LegacyRatingSummaryResponse(APIModel):
    _public_fields = frozenset({"legacy_final_rating", "computed_final_rating"})
    id: int
    imported_at: datetime
    legacy_final_rating: Decimal | None
    computed_final_rating: Decimal | None
    reconciliation_status: str


class AlbumResponse(APIModel):
    _public_fields = frozenset(
        {
            "id",
            "title",
            "artists",
            "year",
            "release_date",
            "release_type",
            "disc_count",
            "tracks",
            "latest_revision",
            "cover_url",
            "needs_revisit",
            "revisit_reason",
            "revisit_marked_at",
            "latest_legacy_rating",
        }
    )
    id: int
    title: str
    musicbrainz_release_id: str | None = None
    artists: list[ArtistResponse]
    year: int | None
    release_date: date | None = None
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
    _public_fields = frozenset({"decades"})
    decades: dict[int, list[int]]


class AlbumRatingSummaryResponse(APIModel):
    _public_fields = frozenset({"average", "rated_count"})
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
    score: Decimal | None = Field(default=None, ge=DomainDecimal("0"), le=DomainDecimal("10"))
    include_in_pre_rating: bool = True
    notes: str | None = None

    @model_validator(mode="after")
    def included_tracks_require_a_score(self) -> TrackRatingRevisionCreate:
        if self.include_in_pre_rating and self.score is None:
            raise ValueError("A track included in PRE requires a score.")
        return self


class RatingRevisionCreate(APIModel):
    coherence: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("10"))
    coherence_notes: str | None = None
    emotion: Decimal = Field(ge=DomainDecimal("0"), le=DomainDecimal("10"))
    emotion_notes: str | None = None
    album_notes: str | None = None
    tracks: list[TrackRatingRevisionCreate]


class TrackRatingRevisionResponse(APIModel):
    _public_fields = frozenset(
        {"track_id", "title", "disc_number", "position", "score", "include_in_pre_rating", "notes"}
    )
    track_id: int
    title: str
    disc_number: int
    position: int
    score: Decimal | None
    include_in_pre_rating: bool
    notes: str | None


class RatingRevisionSummaryResponse(APIModel):
    _public_fields = frozenset(
        {"id", "created_at", "pre_rating", "coherence", "emotion", "bad_experience", "final_rating"}
    )
    id: int
    created_at: datetime
    pre_rating: Decimal | None
    coherence: Decimal
    emotion: Decimal
    bad_experience: Decimal | None
    final_rating: Decimal | None


class RatingBreakdownResponse(APIModel):
    _public_fields = frozenset(
        {
            "pre_contribution",
            "coherence_contribution",
            "bad_experience_contribution",
            "emotion_contribution",
            "final_rating",
        }
    )
    pre_contribution: Decimal | None
    coherence_contribution: Decimal | None
    bad_experience_contribution: Decimal | None
    emotion_contribution: Decimal | None
    final_rating: Decimal | None


class RatingRevisionResponse(RatingRevisionSummaryResponse):
    _public_fields = RatingRevisionSummaryResponse._public_fields | {
        "album_id",
        "coherence_notes",
        "emotion_notes",
        "album_notes",
        "rating_breakdown",
        "tracks",
    }
    album_id: int
    coherence_notes: str | None
    emotion_notes: str | None
    album_notes: str | None
    rating_breakdown: RatingBreakdownResponse
    tracks: list[TrackRatingRevisionResponse]
