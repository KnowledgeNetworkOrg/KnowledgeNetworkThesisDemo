The reviewer's one required fix is done. When the walk editor's three-state Optional button is fully on, it now keeps its green fill while the mouse is over it. Before, pointing at it made "fully on" look exactly like "mixed".

**Why it happened:** the pill decided its background colour by asking "is the mouse over me?" before "am I fully on?". So hovering a fully-on pill swapped its green fill for the ordinary grey hover colour, leaving only the green outline and text. That is exactly how a hovered mixed pill looks. The two states became indistinguishable at the moment the author points at the button to decide whether a press will make every stop optional or clear them all. The app-wide toolbar's version of this button already asks in the right order.

**What I changed:**
- **The pill button:** it now checks "fully on" before hover, as the toolbar does, with a short code comment saying why.
- **Other pills:** unaffected. Only one place in the app turns a pill into a toggle, the walk editor's Optional button, so no other pill looks different.
- **The port record:** this is the file that lists where the app's copies of design-side components differ from the originals. It gets a new entry beside the existing one for the local mixed state. The entry says the pill now differs from the design side's pill on hover, and that unlike the toolbar a fully-on pill never goes bold. Both notes are for the drift log, the standing issue (#74) that tracks such differences.

**What I verified:** the port record still parses as valid JSON. The new end-to-end browser check reads the pill only while the mouse is elsewhere, so the change doesn't break it. I did not run the build, the unit tests or the browser suite, since this step only edits files.

1. fixed

Assumptions: "Record the extra local difference" means a new line in the pill's section of the port record, next to the existing local mixed-state line. I left the design side's own pill untouched, so the same hover problem still exists in their copy. It is flagged in that record entry for the drift log rather than fixed here.