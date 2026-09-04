# Development environment: direct local processes

## Context

The machine already runs other applications, so default ports and shared container infrastructure should not be assumed available.

## Options considered

- Docker Compose for backend and frontend.
- Direct local Python and Node processes.

## Decision

Use direct local processes in this iteration. SQLite needs no service, and a Compose setup would add indirection without isolating a dependency that requires it. Defaults use loopback-only, non-default ports (`8017` API and `5177` UI), configurable in `.env`.

## Consequences

Developers need Python 3.13+ and Node 20+. Docker can be introduced later if setup repetition or a server dependency provides clear value; it must then preserve configurable ports and avoid publishing unnecessary services.

