I've made all the changes for #344. Following this step's rules, I only edited files: I didn't run the build, the unit tests or the browser tests, and I didn't write the design-side receipt or the drift-log comment. None of it is verified yet.

## 1. What changed and why

**Groups no longer carry "optional" (first obligation).** Only individual stops hold the flag now. A group counts as optional only when every stop inside it is, and that is worked out when needed, never saved.
- **The Optional button works on groups and forks.** With one selected, a press sets or clears every stop inside it, in every version and at every depth, as one undo step. Before, it flipped a group's own flag, and it was disabled for forks.
- **The button has three states: on, mixed and off.** Mixed shows the ring without the fill. A press from mixed makes everything optional.
- **Stops added later start out required.**
- **Old saved drafts are converted.** If a group was saved with its own flag, that flag is moved down onto its stops when the draft loads.
- **Bypassing optionals now removes a fully-optional group entirely.** Otherwise it would leave an empty group that still takes a step number.
- **The app-wide toolbar got the design side's three-state button** and its fix for glyphs sitting low next to labels.

**The map shows optional stops (second obligation).**
- **I ported the design side's stop mark whole.** The pill-shaped mark (every map pin and dock dot) now draws as one image and can show a dashed edge. The dash spacing is corrected so the gaps actually appear at small sizes.
- **Each stop in the shared route now carries its flag.** The pin layout gets a list of flags alongside the stop ids, and never merges an optional stop into the same pin as a required one.
- **The projector window now receives the flags**, so the projected map dashes the same pins.

**Italic is the second signal (third obligation).**
- **The mark's number slants on an optional stop.**
- **Optional stop names are italic** on the strip, the dock (open and closed) and the hover card, and they keep their weight, as the amendment says. The "(optional)" word stays regular, and the note after it on the dock's closed rail stays upright.
- **I updated the app's font file** to the design side's version with real bold italics. Without it, the semibold italic names would render as a smeared fake bold.

**Tests and records.**
- **New and updated unit tests:** a new file for the group rules, plus added or changed tests for old drafts, pin merging, the route, the stop mark, and the projector's sample state.
- **Two existing browser checks had to change.** The stop-mark check told pill from circle by "has no drawing inside", which the fix breaks on purpose. The dock check's number selector would now match two spans and crash.
- **One new end-to-end browser check** covers the whole chain on the running page.
- **The port record (PROVENANCE)** has one dated entry per changed component and the font file's new fingerprint.

**One thing I changed beyond the plan.** After pressing Optional, the selection now stays. Every editor action used to clear it, so the obligation's own "press again to clear" needed a re-select first. The flag moves no stop, so there is no stale selection to worry about.

**Still to do:**
- Run the full verify and the browser tests. The new browser check has never run, so treat it as unproven.
- Write the design-side receipt. It should say the flag travels as a list alongside the ids. It can't yet say whether the dock's dashed dot showed before the map change, because I haven't looked at the running page.
- Post the drift-log notes about the app-only mixed pill and the font file.

Assumptions: "Versioned group" means any group or fork, and a press reaches every version, nested groups included. The mixed state goes on the walk editor's pill, where the button actually lives, as a recorded app-only addition. An old draft's group flag is pushed down onto its stops, not dropped. A fully-optional group disappears whole when optionals are bypassed. With several blocks selected, the button reads and sets all of them as one. The selection is kept after an Optional press. The dock's open row keeps its dark style exactly as ported: that means a current optional stop there gets white dashes on a solid fill, which the design side said no caller could produce, so it becomes a question on the receipt rather than a patch. The font file was brought in line by applying the design side's three changed blocks and was not byte-checked against their copy; the port record says so.