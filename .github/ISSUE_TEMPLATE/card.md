---
name: Card
about: One change, small enough for one run to finish and one review to read
---

<!-- One change per card. Work that touches another card's files waits for it, or goes on
     its own card; it does not ride along in this one. -->

**What changes, and why:**

**Files:** <!-- the files to change; name any file under [named by the card] in
.kncode/locked-files that this card may change -->

**Depends on:** <!-- cards or PRs that must merge first, or "nothing" -->

**done when:**
- `npm run verify` passes.
- <!-- what can be checked by a command, one line each -->

**Verify:** <!-- the commands that check this change, e.g. one browser driver:
`node tools/studio-spike/browsertest-<name>.mjs`. Name the drivers that cover the change,
not "every driver passes". -->

**Owner looks:** <!-- what only a person can judge, or "nothing". A `[owner looks]` line
inside done when, as the design agent's cards write it, means the same. -->
