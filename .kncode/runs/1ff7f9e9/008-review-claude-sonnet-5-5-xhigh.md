I found no Must fix or Optional issues in the code, so I recorded PASS. I could only read files in this step. I did not run the tests, the build or lint, so that the budget fix makes `npm run verify` pass rests on the previous step's report.

The first four findings are fixed in the code; the last three nits are still open, and I found two new ones.

- **R0-1** is fixed. `authordraft.ts:202` returns `'The walk draft'`, and `authordraft.unsaved.test.ts` pins the string.
- **R0-2** is fixed.
  - `authordraft.unsaved.test.ts` covers the draft dirty tracking: edit, undo back to baseline, save, and restore.
  - `apptoolbar.test.ts` covers Load being disabled without `load` and enabled with it.
  - `loadpick.test.ts` covers the map-only, walk and unknown-id branches of `applyLoadChoice`, which `onLoadPick` calls.
- **R0-3** is fixed. `LoadDialog.tsx` puts focus back on the card when `pending` goes from set to null, so Escape and the Tab trap work after the warning's Cancel. The change is recorded in `PROVENANCE.json`.
- **R0-4** is fixed. `adherence.test.ts` has `BUDGET = 103`, with a dated note listing the 19 props.

The card's "done when" lines are covered in the code, except the hover preview, which is left out by design. The card says to ship without `preview` and report the task blocked, not done. Nothing outside the card's scope changed, apart from the `StudioView.tsx` and `authordraft.ts` wiring both reviews accepted.

Must fix:
none

Optional:
none

Nit:
1. (R0-5, still open) `src/studio/AppToolbar.tsx:19-23`: the docblock still says load has "no backing model yet, so [it] renders disabled". Load is enabled whenever `load` is passed (line 74).
2. (R0-6, still open) `src/ds/PROVENANCE.json`, the `tailwindTheme.note`: it still says the repointed DomainDot comment line is kept and that ours differs from the DS by that one line. `src/tokens/kn-theme.css:113` now reads `components/graph/DomainDot.jsx`, so the file matches the DS and the sentence is false. The new `lastVendored` entry does not say so.
3. (R0-7, still open) `src/studio/StudioView.tsx:405`: `saveDraftAsWalk('')` can return null, and `applyLoadChoice` runs anyway. The draft stays dirty and the user is not told nothing was saved. Skip the load in that case, or put a comment on it.
4. (new) `src/ds/PROVENANCE.json:543` and nearby: the edit damaged old history text. The StopFinder entry's "★ LOCAL" now reads "? LOCAL", and em dashes became " - " in the StopFinder entries and the 2026-09-05 TextInput entry. Restore the original characters.
5. (new) `src/state/walk/authordraft.ts:202`: the `return` is indented four spaces in a function that otherwise indents two.

Noticed outside this card's scope: none.

Assumptions: I took the hover-preview "done when" lines as unmet by the card's own rule, not as gaps. I counted the 19 undocumented props from the previous review and did not recount them myself.

<!-- kncode-findings
{"reports":[{"id":"R1-8","raisedAgain":false,"bucket":"Nit","what":"The PROVENANCE.json edit re-encoded existing history text: in the StopFinder deviations (line 543) the \u0022\u2605 LOCAL\u0022 marker became \u0022? LOCAL\u0022 and the em dashes became \u0022 - \u0022 throughout, and the TextInput 2026-09-05 entry lost its em dashes too. The new entries are fine; the old ones were damaged by the rewrite. Restore the original characters.","file":"src/ds/PROVENANCE.json","line":543,"breaks":"Not a card line: it corrupts the recorded history of two ports that the card did not ask to change.","failure":null},{"id":"R1-9","raisedAgain":false,"bucket":"Nit","what":"\u0060return dirty ? \u0027The walk draft\u0027 : undefined\u0060 is indented four spaces inside a function whose other line is indented two.","file":"src/state/walk/authordraft.ts","line":202,"breaks":"Layout only.","failure":null}],"answers":[{"id":"R0-1","answer":"Dropped","because":"Fixed: authordraft.ts:202 now returns \u0027The walk draft\u0027, and authordraft.unsaved.test.ts pins that string, so the warning title starts capitalised.","duplicateOf":null},{"id":"R0-2","answer":"Dropped","because":"Fixed: authordraft.unsaved.test.ts covers edit\u2192dirty, undo\u2192clean, saveDraftAsWalk\u2192clean and restored\u2192clean; apptoolbar.test.ts covers Load disabled without \u0060load\u0060 and enabled with it; loadpick.test.ts covers the map-only, walk and unknown-id branches of applyLoadChoice, which StudioView\u0027s onLoadPick calls.","duplicateOf":null},{"id":"R0-3","answer":"Dropped","because":"Fixed: LoadDialog.tsx now refocuses cardRef when \u0060pending\u0060 goes from set to null (wasPending ref \u002B effect), so Escape and the Tab trap work after the warning\u0027s Cancel; recorded as a LOCAL deviation in PROVENANCE.json.","duplicateOf":null},{"id":"R0-4","answer":"Dropped","because":"Fixed: adherence.test.ts BUDGET raised 84 \u2192 103 with the dated \u0022\u002B19, bare in the DS\u0027s own .d.ts\u0022 note listing the same 19 props the finding named.","duplicateOf":null},{"id":"R0-5","answer":"StillOpen","because":"AppToolbar.tsx:19-23 docblock still says \u0022new map / print / save / load / copy / cut / paste have no backing model yet, so they render disabled\u0022; load is enabled whenever \u0060load\u0060 is passed (line 74).","duplicateOf":null},{"id":"R0-6","answer":"StillOpen","because":"The tailwindTheme \u0060note\u0060 in PROVENANCE.json still says \u0022The repointed DomainDot comment line is kept ... still differing by that one line\u0022 and that the DS-vs-ours difference is the deliberate repoint; src/tokens/kn-theme.css line 113 now reads components/graph/DomainDot.jsx, so the file is byte-identical to the DS and the sentence is false. The new lastVendored entry does not say the repoint is gone.","duplicateOf":null},{"id":"R0-7","answer":"StillOpen","because":"StudioView.tsx:405 \u0060if (how === \u0027save\u0027) saveDraftAsWalk(\u0027\u0027)\u0060 still ignores the null return (empty or all-unbound road); applyLoadChoice runs regardless, the draft stays dirty and the user is not told nothing was saved. Neither skipping the load nor a comment was added.","duplicateOf":null}]}
-->
