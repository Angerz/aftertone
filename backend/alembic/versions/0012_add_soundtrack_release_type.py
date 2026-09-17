"""register soundtrack as a release type

Revision ID: 0012_add_soundtrack_release_type
Revises: 0011_favorite_song_entries
"""

revision = "0012_add_soundtrack_release_type"
down_revision = "0011_favorite_song_entries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite stores this application enum as VARCHAR without a CHECK constraint.
    # The column already accommodates "soundtrack"; this revision records the
    # expanded domain without rewriting or changing any existing projects.
    pass


def downgrade() -> None:
    # Existing soundtrack rows deliberately remain untouched on downgrade.
    pass
