Both open findings are fixed, and I found nothing new. The change implements the card. I read the code and ran the card's grep and a JSON parse of `PROVENANCE.json`. I did not run `npm run verify` or the tests.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

**Earlier findings:**
- **R1-4 is fixed.** `src/ds/PROVENANCE.json:175` now names `REFUSAL_REASONS` (`adjacent` and `inside`) without quoting either sentence. `grep -rn "'inside itself'\|'already adjacent'" src/` returns only `src/ds/graph/DropVerdict.tsx:109`, and the file still parses.
- **R1-5 is fixed.** The diff against the run's start shows only the `syncedAt` change and the one new line at `PROVENANCE.json:175`. The 2026-09-26 entry at line 176 is untouched and keeps its four em dashes. The new entry also uses an em dash.
- **R0-2 and R0-3 stay dropped**, as before. The payload is fixed for one drag, so a stale reason cannot show, and the card asks for `npm run verify`, not a browser-driver case.

**What I checked in the card:**
- **Item 1:** `REFUSAL_REASONS`, `DropVerdict.REASONS` and the `DropRefusal` default match `design-system/components/graph/DropVerdict.jsx`. `design-system/` is untouched.
- **Item 2:** `refusedAt` returns `{ ids, reason }` and `dropAllowed` returns `'adjacent' | 'inside' | null`. A target strictly beneath the dragged block's path is `inside`, and the adjacent rule is unchanged.
- **Item 3:** `AuthorRoad.tsx` takes `ok` from `dropAllowed(...) === null` and shows `REFUSAL_REASONS[reason]` in the pill. `handleDrop` returns before any state op on a non-null result, so undo gets nothing new.
- **Tests:** `authordnd.test.ts`, `DropVerdict.test.ts` and `barrel.test.ts` cover both reasons, including a group dragged into its own gap and a no-op `handleDrop`.

**Noticed outside this card's scope:** none.

Assumptions: "inside" means the target path is strictly deeper than the dragged block's path, so dropping a group at its own position stays allowed. I took the unchanged diff context at line 176 as proof the old entry is back to its original bytes, since I cannot run git.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R1-4","answer":"Fixed","because":"src/ds/PROVENANCE.json:175 now names REFUSAL_REASONS (adjacent, inside) without quoting either sentence. I ran the card\u0027s grep over src/ and it returns only src/ds/graph/DropVerdict.tsx:109. The file still parses.","duplicateOf":null},{"id":"R1-5","answer":"Fixed","because":"The diff against the run\u0027s start now shows only the syncedAt change and the one new line at src/ds/PROVENANCE.json:175. The 2026-09-26 entry at line 176 is unchanged context and keeps its em dashes. The new entry uses an em dash too.","duplicateOf":null}]}
-->
