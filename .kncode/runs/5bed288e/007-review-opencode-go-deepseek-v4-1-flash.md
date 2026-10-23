## Must fix:
none

## Optional:
none

## Nit:
none

## Noticed outside this card's scope
none

Assumptions: I treated the in-memory mark as intentionally not cleared by `clearPersistenceIssues()` or `removePersisted()`, matching the card's "until reload"; direct `decodePersisted` calls do not mark a key, matching the card naming only `readPersisted`/`decodeStored`. I ran `npx vitest run src/platform/persisted.test.ts` and `npm run verify`; both passed (67 files, 945 tests).