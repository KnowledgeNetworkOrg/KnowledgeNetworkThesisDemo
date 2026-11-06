1. **Must fix:** nothing.
   - **Optional**
     - **R0-1: fixed** — `src/present/projector.test.ts:18-26`: two new cases pin the field through the protocol (`state` with `blank: true` returned as sent; `close` returns `blank: false`).
     - **Nit**
       - **R0-2: fixed** — `src/present/projector.ts:69-74`: option renamed `shifted`, with a comment that Ctrl/Meta/Alt are filtered before the call.
       - **R0-3: fixed** — `src/present/PresenterScreen.tsx:283` publishes `blank && projecting && !ended`; the key at `:253` only toggles while `projecting && !ended`, so B in the preview no longer sets the flag at all, which also removes the one blank frame after ▶.
       - **R0-4: fixed** — `tools/studio-spike/browsertest-presenter.mjs:268-269`: a comment states the check cannot fail by itself and that the guard lives in the `blankKey` unit test.

Checked with `npx vitest run src/present/projector.test.ts` (11 passed).

Assumptions: I read "modifier key held" as SHIFT (Caps Lock still works, since the key arrives as `B`); the preview now ignores B entirely, since nothing is projected there and it is what keeps a preview B from reaching an open projector window.

Noticed outside this card's scope: the film roll still says "On the projector now" while the room is blanked — a presenter could forget; that is a design question, not this change's.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"src/present/projector.test.ts:18-26 now pins the field through the protocol: a \u0060state\u0060 message carrying \u0060blank: true\u0060 comes back as sent (the late/reloaded projector path \u0022Done when\u0022 4 relies on), and \u0060close\u0060 returns \u0060NOTHING_PROJECTED\u0060 with \u0060blank\u0060 false.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"src/present/projector.ts:69-74 \u2014 the option is renamed \u0060shifted\u0060, and the comment says Ctrl/Meta/Alt are filtered before the handler calls it, so SHIFT alone is what it checks.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"src/present/PresenterScreen.tsx:283 publishes \u0060blank \u0026\u0026 projecting \u0026\u0026 !ended\u0060, and the key at :253 only toggles while \u0060projecting \u0026\u0026 !ended\u0060, so B in the preview no longer sets the flag and no live-and-blank state is published on the \u25B6 render.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"tools/studio-spike/browsertest-presenter.mjs:268-269 \u2014 a comment now says the check cannot fail on its own and that the guard is pinned by the \u0060blankKey\u0060 unit test, so it no longer reads as proof.","duplicateOf":null}]}
-->
