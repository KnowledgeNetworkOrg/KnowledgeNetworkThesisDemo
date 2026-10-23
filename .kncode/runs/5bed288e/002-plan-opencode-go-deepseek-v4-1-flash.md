1. Add a module-level `Set<string>` of keys that read as `future`, recorded in `decodeStored` (which `readPersisted` already uses), so both entry points mark the key.
2. Make `writePersisted` return `false` without touching storage when the key is in that set; leave every other status writing normally.
3. Rewrite the header's save/too-new paragraphs to record the 2026-10-23 decision and remove the two superseded sentences; update the `writePersisted` doc comment.
4. Replace the test that asserts a later save overwrites a newer payload with tests asserting the refusal via both `readPersisted` and `decodeStored`, checking the stored bytes are unchanged.
5. Add a test that keys read as `ok`, `migrated`, `absent` and `corrupt` still get written; give future-read tests distinct keys so the session-scoped marks do not leak into later tests.
6. Run `npm run verify`.

Files: `src/platform/persisted.ts`, `src/platform/persisted.test.ts`

Out of scope: writing the app's first version-2 payload (#483), and any new UI — the card says the read already reports future keys through `persistenceIssues()`, so no new UI is needed.

Verify: Seed the draft key in localStorage with a newer-version envelope, reload, make a draft edit, and observe that the key's bytes are unchanged (and its `future` issue is reported); seed a v1/v0 envelope or corrupt value instead and observe the next save replaces it.
Build: `npm run build`
Test: `npm run test`
Full check: `npm run verify`

Assumptions: The refusal is in-memory per key and lasts until reload, so `clearPersistenceIssues()` and `removePersisted()` do not lift it; tests use distinct keys rather than a test-only reset. Direct `decodePersisted` calls (not via `decodeStored`) do not mark a key, matching the card naming only `readPersisted`/`decodeStored` and keeping that helper pure.