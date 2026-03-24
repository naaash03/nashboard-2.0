# Widget Data Contracts

## Widget Contract Rules

Widgets are allowed to consume:

- canonical NashBoard entities from `lib/sports/models/types.ts`
- `WidgetPayload<T>` envelope metadata (`source`, `fallbackUsed`, `stale`, `fetchedAt`)
- stable internal identifiers (`team.id`, `player.id`, `game.id`)

Widgets should not consume:

- raw APISports payload fields
- raw ESPN payload fields
- provider-only ids as primary display keys

During migration, routes may still include legacy `data` fields for compatibility, but canonical consumers should read the `contract` payload.

## Envelope Format

Canonical widget boundary shape:

```ts
type WidgetPayload<T> = {
  ok: boolean;
  data: T | null;
  error?: string | null;
  source: {
    provider: string;      // apiSports | espn | mlb | fixture | cache | internal
    mode: string;          // live | fallback | fixture
    fallbackUsed: boolean;
    stale?: boolean;
    fetchedAt?: string;
  };
  debug?: {
    notes?: string[];
    requestId?: string;
  };
}
```

## Source Metadata Expectations

- `provider`: actual effective provider used for canonical payload
- `mode`:
  - `live`: primary provider path
  - `fallback`: secondary provider path
  - `fixture`: explicit or policy-allowed fixture path
- `fallbackUsed`: true when hydration/fallback occurred
- `stale`: true when cache was used
- `fetchedAt`: timestamp from provider meta

## Canonical Examples

### Player Card

- Route returns legacy shaped card `data` and canonical `contract`.
- `contract.data` includes canonical `player` and optional `insight`.
- `contract.source` indicates if fallback or fixture was used.

### Watchlist

- Watchlist GET returns DB rows plus canonical contract payload.
- Canonical watchlist teams resolve through shared team mapping.
- Provider ids are attached under `team.providerIds`.

### Search

- Player/team search routes return legacy envelope and canonical `contract`.
- Canonical rows normalize provider ids, team ids, and naming across APISports/ESPN.
- Search contracts use `apiSports` as primary provider reference.

### Team Status

- Team status routes return legacy status envelope and canonical `contract`.
- Canonical status uses `teamId` and optional `todayGame` game model.
- Status metadata shows fallback/staleness explicitly.

## Temporary Bridge Policy

While widgets are migrating:

- legacy response keys remain for backward compatibility
- canonical `contract` is the stable internal boundary
- new widget work should be built against canonical contracts first
