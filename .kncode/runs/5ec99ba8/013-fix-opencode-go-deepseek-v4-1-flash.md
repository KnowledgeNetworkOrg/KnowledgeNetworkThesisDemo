1. **Must fix 1**: fixed — dependencies were already present; the driver was run red against the reverted handler (4 FAILs, cited below) and green with the fix (13/13 PASS). `tools/studio-spike/browsertest-presenterclicker.mjs`. `npm run verify` is left to the check step per the person's answer.
2. **Must fix 2**: fixed — `src/present/PresenterScreen.tsx:206-207` gates both step branches on `!ended`, so the keys fall through to the recap scrollers; the driver's recap check passes (`PageDown scrolls the recap list once the lecture has ended`, `scrollTop 1`).

Person's asks:
- Leave `npm run verify` to the check step: fixed — not run here.
- Confirm Must fix 2 against the code: fixed — `src/present/PresenterScreen.tsx:206-207`.
- Red/green output recorded: fixed — red (4 FAILs) and green (13 PASSes) below; `PresenterScreen.tsx` hash was `C91744E842C9E4EEE743A48A5B81B608FDA7E635E6B24919672560D645283053` before the revert and after the restore.
- Optional 2 (press `ArrowDown`/`ArrowUp` once each): fixed — `tools/studio-spike/browsertest-presenterclicker.mjs:112-123`, both PASS.
- Nit 1 (`returned === after - 1`): fixed — `tools/studio-spike/browsertest-presenterclicker.mjs:109`.

Red run (step keys reverted to arrows only):
```text
FAIL  PageDown advances the record   stop 2 → 2
FAIL  and the deck does not scroll under it   deck scrollTop 1
FAIL  PageUp returns the record to the stop it left   stop 2 → 2
FAIL  ArrowDown advances the record   stop 2 → 2
4 failure(s)
```

Green run (fix restored):
```text
PASS  PageDown advances the record   stop 2 → 3
PASS  and the deck does not scroll under it   deck scrollTop 0
PASS  PageUp returns the record to the stop it left   stop 3 → 2
PASS  and the deck stays at the bottom where PageUp found it   deck scrollTop 244 of 244
PASS  ArrowDown advances the record   stop 2 → 3
PASS  ArrowUp returns the record   stop 3 → 2
PASS  PageDown scrolls the recap list once the lecture has ended   scrollTop 1
13 checks passed
```

Assumptions: `node_modules` was already installed in this workspace, so no `npm ci` was needed; the driver ran against Edge. `desktop/node_modules` is still absent, but `verify` belongs to the check step.