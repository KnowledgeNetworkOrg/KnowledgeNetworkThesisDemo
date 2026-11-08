I found nothing that blocks this change. I did not run the full suite, lint or any browser driver.

The four earlier findings belong to the reviewer who raised them, so the tool would not record my answers to them. I checked each one against the new code:
- **R0-2:** fixed. Both `walkstore.test.ts` and `draftpersist.test.ts` now have a per-corpus test. With both the plain key and the `:cs2023` key seeded, it checks that the store reads and writes only `:cs2023` and leaves the plain key alone. The existing teaching rows are unchanged.
- **R0-3:** fixed. The doc comment now sits directly above `CORPUS_NAME` in `graph.ts`.
- **R0-4:** fixed. The driver now records a thrown step and still prints the checks made before it. The checks are numbered 1–6 in order.
- **R0-5:** the fixer is right to leave it. `AppHeader.tsx:55` spaces only its direct children, so the two pills inside the required `studio-dataset` span would touch without the gap. The gap uses only a token.

Every requirement in the card is in the code:
- **Choosing the dataset:** the address is parsed in a pure function, then `VITE_CORPUS`, then `teaching`. `CORPUS_NAMES` is exported, and the comments now say both corpora ship in every build.
- **Saved work per dataset:** `corpusKey` is used for the saved walks, the desk draft and the notebook key.
- **Projector:** the window opens at a path that carries the corpus, from both calls.
- **Switch:** it is drawn as a header child, and `AppHeader.tsx` is not edited.
- **Drivers and docs:** the new driver is written, the two existing drivers use the new keys, and `CLAUDE.md` is updated.

The other drivers that still use the plain keys all run on `teaching`, as the card says. The three stops the new driver seeds exist in `teaching` and not in `cs2023`.

**Must fix:** none

**Optional:** none

**Nit:** none

**Noticed outside this card's scope:** none

Assumptions: Three things the card asks for are not in the code, so I did not review them here: the bundle growth figure, the note on the projector's known limit, and the list of keys left as they are. They are for the PR text. I took the earlier step's report that the three touched test files pass (50 tests) without running them myself.