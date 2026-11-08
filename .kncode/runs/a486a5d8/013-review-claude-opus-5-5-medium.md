I found nothing to fix, and the last open finding (R1-2) is fixed in the code.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

I checked R1-2 against the files themselves:
- `tools/studio-spike/browsertest-cs2023marks.mjs:265` now ends "teaching does not".
- `src/model/standingnotice.test.ts:14` now reads "is null on teaching even when the sentence is there".
- I answered it FIXED. R0-1 also holds in `CLAUDE.md`: the line now says "the *other* corpus".

The card's requirements are in place:
- **Done-when search:** the card's grep prints nothing (exit 1).
- **Deleted files:** `tools/courseimport/` is gone. So are the four `src/corpus/course*` files and `browsertest-coursecorpus.mjs`.
- **`graph.ts`:** `CorpusName` is `'teaching' | 'cs2023'` and `CORPUS_NAME` picks cs2023, otherwise teaching. The `built` line is a two-way ternary, and its comment says "the other one".
- **`docs.ts` and `walks.ts`:** `DOC_BODY` and `WALKS` are two-way ternaries, cs2023 first.
- **`PLAN` and `SEED`:** both match the card. `authordraft.ts` imports only `CORPUS_NAME` now.
- **The four tests:** `lensmessage` uses `'teaching'` and keeps `enclosingTitle: 'Anything'`. `visited` and `standingnotice` lost only the repeated line. `lecturenotes:491` uses `'cs2023'`.
- **`browsertest-relationsrail.mjs`:** the last section runs on `withApp('cs2023', { VITE_CORPUS: 'cs2023' }, …)` and checks for `see_also`. Its banner, check names and header say cs2023 and "unit", and every check is still there.
- **Comments:** `flat.ts:200`, `devserver.mjs:24`, `corpusbuild.ts`, `README.md` and `CLAUDE.md` are updated as the card says.

**Noticed outside this card's scope**
- `src/instruments/DocumentPanel.tsx:31` still says "The other corpora's walks…", which with two corpora means teaching alone. The card doesn't list it and the grep doesn't match it.

Assumptions: I ran no tests (`npm run verify` or the browser drivers); I read and searched the files only. That `npm run verify` and the browser drivers pass is what earlier steps reported, not something I saw.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R1-2","answer":"Fixed","because":"browsertest-cs2023marks.mjs:265 now ends \u0022teaching does not\u0022; standingnotice.test.ts:14 now reads \u0022is null on teaching even when the sentence is there\u0022. Checked in the files.","duplicateOf":null}]}
-->
