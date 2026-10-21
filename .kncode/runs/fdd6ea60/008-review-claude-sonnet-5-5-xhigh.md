Must fix:
1. `src/ds/PROVENANCE.json:175` — The new OB-299 entry quotes both sentences in single quotes (`'already adjacent'`, `'inside itself'`). The card's done-when says: "`grep -rn "'inside itself'\|'already adjacent'" src/` finds them only in `DropVerdict.tsx`." I ran that grep and it returns two files, `src/ds/graph/DropVerdict.tsx:109` and `src/ds/PROVENANCE.json:175`. The earlier fix for R0-1 broke this line. Reword the entry so neither sentence sits in single quotes, for example "adopted `REFUSAL_REASONS.adjacent` and `REFUSAL_REASONS.inside`".

Optional:
none

Nit:
1. `src/ds/PROVENANCE.json:176` — The same edit rewrote the existing 2026-09-26 entry, changing its em dashes to hyphens, and the new entry uses hyphens too. The rest of the file uses em dashes (335 of them). Put the old entry's text back and match the file's style, so the diff shows only the new line and the `syncedAt` change.

Earlier findings:
- **R0-1** is FIXED. The entry is there with `syncedAt` 2026-10-21 and the three divergences, and the file still parses. The wording of that entry is what breaks the grep above.
- **R0-2** is DROPPED. The payload is fixed for one drag, so a stale reason cannot show today.
- **R0-3** is DROPPED. The card's done-when asks for `npm run verify` and unit coverage, not a browser-driver case.

Everything else in the card is in place:
- `REFUSAL_REASONS`, `DropVerdict.REASONS` and the `DropRefusal` default match `design-system/components/graph/DropVerdict.jsx`.
- `refusedAt` and `dropAllowed` return `inside` for a gap strictly beneath the dragged block's path, and `adjacent` as before.
- `handleDrop` refuses before any state op, so undo gets nothing new.
- The `AuthorRoad.tsx` pill reads from `REFUSAL_REASONS`, and tests cover both reasons.
- `design-system/` is untouched.

I only read the code and ran the grep and a JSON parse of `PROVENANCE.json`. I did not run `npm run verify` or the tests.

Noticed outside this card's scope: none.

Assumptions: "inside" means the target path is strictly deeper than the dragged block's path. The card's grep is judged over every file under `src/`, JSON included, as it is written.

<!-- kncode-findings
{"reports":[{"id":"R1-4","raisedAgain":false,"bucket":"MustFix","what":"The new OB-299 entry added to src/ds/PROVENANCE.json quotes both sentences in single quotes (\u0027already adjacent\u0027, \u0027inside itself\u0027). The card\u0027s own check, \u0060grep -rn \u0022\u0027inside itself\u0027\\|\u0027already adjacent\u0027\u0022 src/\u0060, now returns src/ds/PROVENANCE.json:175 as well as src/ds/graph/DropVerdict.tsx:109. Reword the entry so neither sentence appears in single quotes, for example \u0022adopted REFUSAL_REASONS.adjacent and REFUSAL_REASONS.inside\u0022. The run\u0027s other quoted-sentence mentions in the entry should go the same way.","file":"src/ds/PROVENANCE.json","line":175,"breaks":"Card done-when: \u0022Both sentences come from \u0060REFUSAL_REASONS\u0060; \u0060grep -rn \u0022\u0027inside itself\u0027\\|\u0027already adjacent\u0027\u0022 src/\u0060 finds them only in \u0060DropVerdict.tsx\u0060.\u0022 I ran the grep: it finds two files.","failure":null},{"id":"R1-5","raisedAgain":false,"bucket":"Nit","what":"The same edit rewrote the existing 2026-09-26 deviation entry, changing its em dashes to hyphens, and the new entry also uses hyphens, although the rest of the file uses em dashes (335 occurrences). Restore the old entry\u0027s text and match the file\u0027s style, so the diff shows only the new line and the syncedAt change.","file":"src/ds/PROVENANCE.json","line":176,"breaks":"No card line broken; it is churn in a history record that the card did not ask to change.","failure":null}],"answers":[{"id":"R0-1","answer":"Fixed","because":"src/ds/PROVENANCE.json:173,175 now has syncedAt 2026-10-21 and a dated OB-299 entry naming the three divergences (the RefusalReason type, the doc-comment placement, the omitted \u0022PASS ONE OF REFUSAL_REASONS\u0022 paragraph); the file still parses. The way the entry was worded breaks the card\u0027s grep line, raised separately as a new Must fix.","duplicateOf":null},{"id":"R0-2","answer":"Dropped","because":"Accepted: the payload is fixed for the length of one drag, so one gap gives one reason and a stale reason cannot show today. The finding itself called it harmless.","duplicateOf":null},{"id":"R0-3","answer":"Dropped","because":"Accepted: the card\u0027s done-when asks for npm run verify and the unit coverage, not a browser-driver case; tools/studio-spike/browsertest-dropverdict.mjs is outside the card\u0027s files.","duplicateOf":null}]}
-->
