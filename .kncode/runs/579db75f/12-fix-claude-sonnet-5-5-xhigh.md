Nothing to fix.

The reviewer listed no "Must fix" items, so I changed no files and ran no build or test. By the rules of this step, a test run only follows an edit.

I left the five optional notes alone because they don't block anything:
- **Nothing has been run yet.** The check step that follows builds, tests and runs the browser drivers, so it will settle this.
- **No unit test covers the `+ 1` on the on-screen attributes.** That is a possible future addition, not a flaw in this change.
- **The leftover "SEPARATE" tests number their pins from 1.** Nothing asserts on that number, so it is cosmetic.
- **The pull request text must say the on-screen step number still counts from 1.** That is for the pull request description, not for code.
- **The card's names are stale.** `pinMarks` is now `marks`, and the camera check moved to another file. The code follows the card's intent.

Assumptions: I took "Must fix: none" at face value and did not re-read the code to second-guess it. I read the reviewer's closing question as a request to the check step to run the full verification on a machine with Edge, not as something stuck that I should flag.