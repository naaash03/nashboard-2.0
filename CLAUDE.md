# CLAUDE.md — NashBoard 2.0 Working Guide (v1)

## What this project is

NashBoard is a customizable sports analytics dashboard for casual fans.

Core product idea:
- make advanced sports stats understandable
- make dashboards interactive and personal
- support beginner and advanced users without splitting the product into two separate apps

North star:
**truth first, then intelligence**

Do not add “smart” features on top of a shaky data layer.

---

## Current project reality

The repo is in an active build/refactor stage.

There is already meaningful functionality, but there are still important truth-layer issues that need to be fixed before predictive or AI-heavy work expands.

Current known focus:
1. widget sport persistence correctness
2. provider/source metadata honesty
3. provider health diagnostics coverage
4. multi-sport watchlist persistence alignment
5. predictive foundations after the above are stable

Important framing:
**Truth hardening is not a detour from AI work. It is Phase 0 of AI work.**

---

## Product principles

- beginner mode must stay readable, friendly, and useful
- advanced mode can be deeper, but should stay honest and structured
- never mislabel data sources
- never pretend demo/scaffold/partial output is fully real
- never silently hide fallback behavior
- avoid shipping confusing or duplicated widgets
- free-first mindset: avoid paid dependencies unless explicitly approved
- keep the app useful even when providers are flaky

---

## Current priorities (in order)

### Phase 0 — Truth & Persistence Hardening
Do these before major predictive/AI feature expansion.

#### 0.1 Widget sport persistence
Fix any place where new widgets or saved widget state use a hardcoded or incorrect sport value.

This is P0 because silent corruption of saved widget sport breaks trust and makes later debugging harder.

#### 0.3 Provider/source metadata honesty
Fix any resolver/route/payload that claims the wrong primary provider.

Example risk:
MLB widget payload says ESPN even though MLB Stats API is the real backbone.

This is load-bearing for future AI/predictive work.

#### 0.4 Health diagnostics
`/api/health/data` should reflect real provider dependencies.

Cover:
- ESPN
- MLB Stats API
- BALLDONTLIE

Diagnostics should help answer:
“is the widget broken, or is the provider down?”

#### 0.2 Watchlist persistence alignment
The UI is multi-sport. Persistence must match that.

Target shape:
- `sport`
- `entityType`
- `entityId`
- `entityName`

Guest and signed-in behavior should feel aligned.

---

## What not to do right now

Do not:
- build a bunch of new predictive widgets in parallel
- add AI commentary that cannot cite its structured inputs
- hardcode provider labels just to make metadata “look complete”
- hide scaffold/demo output behind polished UI
- start broad repo-wide style refactors unless explicitly asked
- introduce paid AI dependencies casually
- add more duplicate widgets without first checking whether an existing one should be improved instead

---

## Tech stack

- Next.js
- React
- TypeScript
- Prisma
- PostgreSQL
- Tailwind
- Vitest

General preference:
- TypeScript only
- no implicit `any`
- small reviewable diffs
- prefer existing patterns/types/contracts before inventing new ones

---

## Data provider map

This map should be treated as a working truth map, not a marketing description.

### MLB
Primary truth source for MLB-specific stats: **MLB Stats API**

### NBA
Uses **BALLDONTLIE** and/or **ESPN** depending on feature

### NFL
Currently built mainly around **ESPN** unless otherwise stated

Important rule:
**never label a widget/source field from memory or assumption**
Verify the actual provider used in the resolver/route path.

---

## Architecture rules

For widgets, follow this path whenever possible:

**metadata -> API route -> transformer/resolver -> UI component -> registry -> test**

Do not skip layers unless there is a good reason.

### Preferred backend behavior
- thin routes
- reusable resolver/transformer logic
- pure functions for derived calculations
- consistent payload contracts
- explicit fallback behavior
- truthful source metadata
- mode-aware payload shaping where useful

### Preferred frontend behavior
- components focused on rendering
- beginner mode should simplify without lying
- advanced mode should deepen context, not just dump more numbers
- loading/error/fallback states must be explicit

---

## Widget standard

Whenever adding or repairing a widget, follow this checklist:

1. define purpose
2. add/update metadata
3. create/fix API route
4. create/fix transformer or resolver
5. build/fix UI component
6. register widget
7. add/update tests
8. validate persistence
9. validate source/provider metadata
10. validate beginner vs advanced behavior

Quality bar:
- API stable
- UI renders
- persistence works
- fixture/fallback works
- no misleading source labels
- no console junk
- no silent failure states

---

## API and payload rules

Prefer standardized response shapes.

At minimum, backend/widget/provider flows should be easy to trace and should expose:
- `data`
- `meta`
- `error`

`meta` should be honest and useful.

When relevant, include things like:
- `sourceUsed`
- `updatedAt`
- `ttl`
- freshness / fallback indicators
- partial/scaffold/demo markers

Do not invent “complete” looking metadata if the source is uncertain.

---

## Honesty rules for partial/demo/scaffold output

Some widgets may temporarily rely on:
- demo data
- partial data
- scaffold logic
- fallback data
- hybrid outputs

That is okay **only if clearly marked**.

Preferred explicit flags:
- `isPartial`
- `partialReason`
- `isScaffold`
- `isDemo`
- `isFallback`
- `fallbackReason`

The UI should not present these states as fully real/live if they are not.

---

## Predictive feature rules

Predictive work starts only after the truth layer is stable enough.

Before building multiple predictive widgets, establish shared foundations:
- derived metrics module
- prediction payload contract
- honest fallback pattern
- source-aware metadata
- health-aware debugging path

### Prediction contract expectations
A predictive payload should be structured and explainable.

Prefer fields like:
- point estimate
- range / band
- confidence label
- explanation
- key factors
- inputs used
- sources used
- generatedAt
- isFallback

Beginner mode:
- simple estimate/range
- plain-language explanation

Advanced mode:
- breakdown of factors
- richer input context
- still honest and readable

---

## AI analysis rules

AI commentary is separate from statistical prediction.

If/when AI analysis is added:
- it must cite the structured data points it used
- it must degrade gracefully on failure
- it must have a rules-based fallback
- it must not become an untraceable hallucination layer
- model usage must respect the project’s free-first mindset unless explicitly approved otherwise

Before adding real LLM-backed features, decide:
- request-time vs precomputed
- model choice
- cache policy / TTL
- failure mode
- cost ceiling
- env var configuration
- fallback behavior

Do not improvise this mid-widget.

---

## Reuse rules

Push reusable logic into pure functions when possible.

Good candidates for shared modules:
- recent form calculations
- matchup deltas
- pace-adjusted metrics
- ranking helpers
- beginner explanation helpers
- honest partial/demo/fallback helpers

Avoid:
- duplicating the same math in multiple routes
- provider calls inside pure math helpers
- UI-only components owning business logic that belongs in resolvers

---

## Testing expectations

For touched areas, prefer:
- fixture-backed tests
- contract/shape tests
- persistence tests
- source metadata tests
- fallback-state tests
- mode-awareness tests

High-priority test areas right now:
- widget sport persistence
- watchlist multi-sport contract
- provider/source metadata honesty
- `/api/health/data` provider coverage
- any new predictive contract work

If you change a widget and do not add or update a meaningful test, explain why.

---

## Branching and workflow

- `main` must stay stable
- use focused branches:
  - `feature/`
  - `fix/`
  - `refactor/`
- prefer small, reviewable passes
- commit clearly
- run tests before merge
- manual validation matters

General loop:
1. inspect branch and git status
2. understand scope before editing
3. make focused changes
4. run relevant tests
5. summarize files changed and why
6. call out risks / follow-up work

---

## How Claude should operate in this repo

At the start of a session:

1. read this file first
2. check current branch
3. inspect git status / recent diffs
4. identify the active phase/task
5. avoid broad refactors unless requested
6. prefer repo-specific fixes over generic advice

When responding after a coding pass, always include:
- exact files changed
- why each file changed
- what was fixed
- what was not fixed
- tests run
- known caveats / risks
- recommended next step

If uncertain, say so directly instead of pretending the repo is cleaner than it is.

---

## Tool guidance

### Prefer Claude Code for
- repo-wide tracing
- multi-file bug hunts
- architectural fixes
- understanding how files connect
- refactors where root cause is unclear

### Prefer Codex / focused generation for
- small isolated file tasks
- pure type/schema creation
- boilerplate helpers
- targeted one-file transforms when the contract is already known

### Prefer chat review for
- planning
- prompt refinement
- diff review
- deciding whether a pass is actually safe to commit

---

## Known risk areas

- widget sport persistence may be corrupting saved state
- watchlist signed-in persistence does not fully match the multi-sport UI
- provider/source metadata may be misleading in some widgets
- health diagnostics do not yet fully reflect all real dependencies
- some older widgets predate cleaner resolver patterns
- some newer experimental widgets may use hybrid/scaffold behavior that should be formalized

---

## Session handoff rule

After every meaningful work session, update this file or a related handoff doc with:

- what changed
- what is now true
- what is still broken
- what should happen next

This file should stay short enough to be useful and current enough to trust.

If it becomes stale, trim it and refresh it.