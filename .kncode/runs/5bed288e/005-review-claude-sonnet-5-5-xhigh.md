I reviewed the change against the card and found nothing that needs fixing, so the verdict is PASS. I read the code and tests but did not run `npm run verify` or the tests. Running them would write build output, which this review step may not do. The previous step reported that the focused test passed.

**Must fix:**
none

**Optional:**
none

**Nit:**
1. `src/platform/persisted.test.ts:97` — The future-read tests now use distinct keys such as `pkt.future.read`, because the refusal lasts for the whole session. Nothing in the file says so. A later test that reuses a key an earlier test read as future would fail with no hint why. A one-line comment would record it.
2. `src/platform/persisted.ts:28` — The status table still says a `future` payload is "reported, and left alone by the read". It is now also left alone by every later save this session. Saying so there would match the new paragraph further down.

**What I checked against the card:**
- **Refusal:** `decodeStored` records a key that reads as `future` (`persisted.ts:195`), and `readPersisted` goes through `decodeStored`. `writePersisted` returns `false` and writes nothing for such a key (`persisted.ts:221`).
- **Other statuses:** `ok`, `migrated`, `absent` and `corrupt` keys are not marked, so they write as before.
- **Mark storage:** The marks live in their own `Set`, not the capped issue log. Old issue entries sliding out therefore cannot re-enable overwriting.
- **Header:** Both superseded sentences are gone, and the new paragraph records the 2026-10-23 decision. The `writePersisted` doc comment was updated too.
- **Tests:** The old test asserting that a save overwrites a newer payload is replaced. New tests cover refusal through `readPersisted` and through `decodeStored`, each checking the stored bytes are unchanged, and one test that `ok`, `migrated`, `absent` and `corrupt` keys are still written.
- **Existing future-read test:** It was moved off `pkt.x`, which would otherwise have stayed marked and broken the later tests that write that key.
- **Scope:** Only `persisted.ts` and `persisted.test.ts` changed, and neither is in `.kncode/locked-files`.
- **Other callers:** `walkstore`, `draftpersist` and `lecturenotes` call the same functions, and no other test reads a future payload and then writes the same key.
- **Legacy `.v1` keys:** `lecturenotes.ts` reads them with `decodeStored` and never writes them (it only removes them). Marking one as future therefore has no effect.

Assumptions: I took "stays unwritten for the rest of the session" to mean the mark is in memory and is not lifted by `removePersisted` or `clearPersistenceIssues`, as the plan assumed. I also took the card's wording (a key that read as `future` "through `readPersisted` or `decodeStored`") to mean that a direct `decodePersisted` call does not mark a key.

<!-- kncode-findings
{"reports":[{"id":"R0-1","raisedAgain":false,"bucket":"Nit","what":"The future-read tests now use distinct keys because the refusal mark lasts for the whole module session, but nothing in the test file says so. A later test that reuses a key an earlier test read as future (for example \u0027pkt.x\u0027) and then writes it would fail with no hint why. A one-line comment above the future-read tests would record it.","file":"src/platform/persisted.test.ts","line":97,"breaks":"None of the card\u0027s lines. Maintainability of the new session-scoped state in tests.","failure":null},{"id":"R0-2","raisedAgain":false,"bucket":"Nit","what":"The status table says a \u0060future\u0060 payload is \u0022reported, and left alone by the read\u0022. After this change it is also left alone by every later write this session, which only the new paragraph further down says. Adding \u0022and by every later save\u0022 to this table line would keep the table consistent with the new rule.","file":"src/platform/persisted.ts","line":28,"breaks":"None of the card\u0027s lines. Header wording only.","failure":null}],"answers":[]}
-->
