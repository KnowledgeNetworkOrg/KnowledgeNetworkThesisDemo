I read the change against the card and found no gap that blocks it. I didn't run the tests, the lint or the browser drivers, because running them would write files and this step is read-only. My checks come from reading the code.

What I checked and found in place:
- **Address parsing:** `parseCorpusName` and `CORPUS_NAMES` in `src/corpus/graph.ts` take no imports. The address wins over `VITE_CORPUS`, which wins over `teaching`. `nonsense`, `courses`, other casing and an empty value fall through.
- **Tests:** `corpusname.test.ts`, `corpuskey.test.ts`, the notebook-key rows in `lecturenotes.test.ts` and the `projectorPath` rows in `projector.test.ts` all exist.
- **Per-dataset keys:** `corpusKey` is used for the saved walks, the Walk Desk draft and `notebookKey`. The sessions, categories, habits, prepared notes and legacy readers are untouched.
- **Switch:** `CorpusSwitch` is drawn as a third child of `AppHeader`. The span is labelled `studio-dataset`, the current pill is `selected`, and pressing the current pill does nothing. It keeps the other query values. `AppHeader` and `src/ds/**` are unchanged.
- **Projector and docs:** both `platform.openWindow` calls use `projectorPath(CORPUS_NAME)`. The `graph.ts` comments are updated, and `CLAUDE.md` is updated as the card names it.
- **Drivers:** the new datasetswitch driver covers every bullet in "Done when". The two existing drivers follow the key rename. Every hook the new driver uses exists in `src/` or the registry, so `browsertestguard.test.ts` should accept it.

Must fix:
none

Optional:
1. `src/state/walkstore.ts:32`: `walkstore.test.ts` and `draftpersist.test.ts` are untouched. The card's Files list names them, but its "Done when" only needs the existing teaching rows to keep passing, so this is not a gap. Nothing at unit level shows that `walkstore.ts` and `draftpersist.ts` build their keys through `corpusKey`. Only the cs2023lists and cs2023corpus drivers would notice if that wiring were dropped.

Nit:
1. `src/corpus/graph.ts:47`: the `/** which corpus this page is showing … */` doc comment now sits above `buildEnv`, not `CORPUS_NAME`. The new `pageAddress` line widens that gap.
2. `tools/studio-spike/browsertest-datasetswitch.mjs:118`: the checks are printed only after the `finally`, so a thrown step (for example the `waitForURL` timeout) loses the lines collected so far. The "3:" check also sits between two "2:" groups.
3. `src/studio/CorpusSwitch.tsx:17`: the wrapper span has an inline `style`. It uses only tokens and passes the lint, but the card says the file is "cleaner still" using only `PillButton`.

Noticed outside this card's scope: none.

Assumptions: I took "Done when" as the requirement for the walkstore and draftpersist tests, which makes finding 1 Optional. The card also asks for the bundle growth, the projector known limit and the list of unchanged keys in the PR text; that is outside the repo, so I didn't check it.

<!-- kncode-findings
{"reports":[{"id":"R0-2","raisedAgain":false,"bucket":"Optional","what":"walkstore.test.ts and draftpersist.test.ts are not touched. Nothing at unit level shows that \u0060walkstore.ts\u0060 and \u0060draftpersist.ts\u0060 build their key through \u0060corpusKey\u0060. Only the two browser drivers (cs2023lists, cs2023corpus) would notice if that wiring were dropped.","file":"src/state/walkstore.ts","line":32,"breaks":"The card\u0027s Files list names \u0060walkstore.test.ts\u0060 and \u0060draftpersist.test.ts\u0060 among \u0022their tests\u0022. The done-when only requires that the existing teaching rows still pass, so this is not a hard gap. The cs2023 key for the saved walks and the desk draft is checked only by the unit tests of \u0060corpusKey\u0060 itself and by the browser drivers.","failure":null},{"id":"R0-3","raisedAgain":false,"bucket":"Nit","what":"The \u0060/** which corpus this page is showing ... */\u0060 doc comment now sits above \u0060buildEnv\u0060, with the comment block and \u0060pageAddress\u0060 between it and \u0060CORPUS_NAME\u0060. Editors attach the doc to \u0060buildEnv\u0060, not to the constant it describes. The layout was already like this, and the new \u0060pageAddress\u0060 line widens the gap.","file":"src/corpus/graph.ts","line":47,"breaks":"Layout only: hovering \u0060CORPUS_NAME\u0060 in an editor shows no description, while \u0060buildEnv\u0060 shows the wrong one. No card line is broken.","failure":null},{"id":"R0-4","raisedAgain":false,"bucket":"Nit","what":"The driver prints its PASS/FAIL lines only after the \u0060finally\u0060. If a step throws (for example the \u0060waitForURL\u0060 timeout in \u0060switchTo\u0060), none of the checks collected so far are printed. The check numbering is also out of order: the \u00223:\u0022 check sits between two \u00222:\u0022 groups.","file":"tools/studio-spike/browsertest-datasetswitch.mjs","line":118,"breaks":"Readability of a failed run only. The exit code is still nonzero, and no card line is broken.","failure":null},{"id":"R0-5","raisedAgain":false,"bucket":"Nit","what":"The wrapper span carries an inline \u0060style\u0060 (\u0060display: \u0027inline-flex\u0027, gap: \u0027var(--space-1)\u0027\u0060). It uses only tokens, so it passes the lint, but the card says the file is \u0022cleaner still if it only uses \u0060PillButton\u0060\u0022. A plain span in the header\u0027s flex row would also work.","file":"src/studio/CorpusSwitch.tsx","line":17,"breaks":"Style only. The card says no raw colours or pixel values, and none are used.","failure":null}],"answers":[]}
-->
