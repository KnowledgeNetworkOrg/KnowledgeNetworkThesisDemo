1. Nothing to fix. The reviewer's "Must fix" list was empty, so I changed no files and ran nothing.

The reviewer confirmed the card's three requirements. The pin model now counts stops from 0, the same as the design system. The pin-marks builder and the playback camera do no arithmetic. The only `+ 1` left sits on the two on-screen number attributes, which the card allows. The reviewer also checked every place that reads a pin's step numbers and found all of them updated.

I left the four optional notes alone, as this step permits:
- **Nothing has been run yet.** The build, unit tests, lint and browser drivers are unconfirmed so far. The check step that follows this one is where they run.
- **No unit test covers the `+ 1` on the on-screen attributes.** Only the browser drivers would catch it if a later edit dropped it.
- **The "SEPARATE" tests still number their hand-built pins from 1.** No test asserts on those numbers, so it is only a cosmetic leftover.
- **The pull request text must say the on-screen number still counts from 1.** The tool writes the description, so that wording is not mine to edit here.

Assumptions: I took "you may leave Optional alone" literally, including the leftover hand-built pin numbers. I also did not raise the reviewer's "can the checks be run?" question as a stuck-step flag, since it is the check step's job, not a disagreement between reviewer and fixer.