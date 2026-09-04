# Local album covers use filesystem storage

## Context

Cover art is mutable album metadata for a local, single-user journal. Keeping
original image bytes in SQLite would make ordinary image serving and replacement
less natural, while a filesystem directory keeps the database focused on
structured journal data.

## Decision

Store a nullable generated cover filename on `Album` and save normalized WebP
files under the configurable `AFTERTONE_COVER_DIR`. API responses expose only a
media URL, never the local filesystem path. Replacing a cover writes the new
file, persists its key, then removes the prior file.

## Consequences

A complete backup consists of the SQLite database and the cover directory.
Covers are not part of rating revisions and remain excluded from version control.
