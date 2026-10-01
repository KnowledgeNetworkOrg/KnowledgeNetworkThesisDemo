1. **Must fix #1 (categories stored in a shape its own reader rejects on the move):** fixed — `loadWithLegacy` now commits the value as it was *stored* (`legacy.writeBack`), not the value `parse` returned, matching `readPersisted`. This also stops the move dropping unknown habit fields / a mis-typed deck. Added the second `loadMintedCategories()` assertion to the move test.

Verified: `npx vitest run src/present/lecturenotes.test.ts` — 21 passed.

Assumptions: I applied the same pre-parse "write back" rule the reviewer named for `readPersisted`, treating a legacy read as `ok` (no `writeBack`) by falling back to the parsed value.