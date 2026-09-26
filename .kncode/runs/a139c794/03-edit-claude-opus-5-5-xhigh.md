I've made all the changes for #342. The project's full check passes, the whole browser test suite passes, and I looked at the running page to confirm the result. The one piece left is the receipt to the design project, explained at the end.

**What you'd see now (Explore layout)**
- **Nothing selected:** the Document pane shows a dashed "Nothing chosen" box. It used to fall back to the whole-corpus root.
- **Pointing at a map cell:** the pane previews that node's document under a "PREVIEW · hovering X — click to select it" line. That line always keeps its height, so the text below never jumps. Moving off the map returns to "Nothing chosen". Un-selecting gives exactly the same look as first opening the app.
- **After selecting a node:** a Relations panel sits beside the prose, and it can be hidden and brought back. It shows:
  - a round drawing of the node's neighbours: the direction around the circle is the kind of relationship, and the distance from the centre is direct versus through a child;
  - under it, a summary rather than a list: how many neighbours and relationships, a direct/indirect bar, and one bar per relationship kind.
- **Hover card:** hovering a neighbour or a line opens a card over the prose, never over the drawing. Its header is a sentence such as "1 direct relationship". Hovering the centre dot opens the node's own document card instead.
- **The map and the drawing light each other:**
  - Hovering a neighbour in the drawing lights that neighbour and the one road to it on the map, and dims the other roads.
  - Hovering the centre dot tints the selected cell and lights no road. This needed a new, separate "centre" signal between panes, because reusing the existing hover signal would have lit every road at once.
  - Pointing at a neighbour on the map lights its dots in the drawing, without opening a card.
- **The relationship card:** its left divider line now appears only when the card has more than one target, and it takes no space otherwise.

**Things I found along the way**
- **A defect in the design's drawing.** If two children of a node relate the same way to the same outside node, the design draws both marks on one spot. The summary still counted two, and React warned about duplicate keys. I fixed it in our copy and will report it upstream.
- **A contradiction inside the design's own item.** The preview line drops its test marker when nothing is previewed, but OB-209's own checklist requires the marker to be there in that state. I made it always present.
- **An open conflict with OB-240.** OB-240 says the document should keep showing a node after you un-select it. I followed OB-209, which the card names as the authority, so un-selecting shows "Nothing chosen". This needs flagging to the design agent.
- **Cramped card at the Explore width.** The pane is about 446 pixels wide there, so the card is 206 wide and long names get cut to "Set Theo…". That is how the design sizes the card, but it's worth raising with them.

**What I verified**
- The full project check passes: build, desktop type check, lint, and 698 unit tests. That includes new tests for the drawing's placement rules, the summary's counts, the sentence wording, the divider, and the "through a child" roll-up.
- The whole browser suite passes, 33 of 33. Two older tests failed in the first second and passed when re-run alone. They share one port with each other, a known pre-existing problem, and are unrelated to this change.
- A new browser test makes 57 checks across both corpora. It covers all six done-when lists. In the university course corpus it checks a real unconnected course (CPS 714) and the one-kind half circle.
- I looked at screenshots of each state, including close-ups confirming the centre tint on the map is visible.

**What's left**
- **The receipt to the design project isn't filed yet.** It has to cite the real commit, which only exists after the tool commits. This step was also limited to editing files. Once committed, it should report: the six items done; the file is really `DocumentPanel.tsx`, not `DocumentPane.tsx` as three items say; the OB-240 conflict; and the two design defects above.
- Remembering the panel's width across reloads stays with #368.

Assumptions:
- Un-selecting shows "Nothing chosen" (OB-209 over OB-240).
- The panel's "through a child" count skips relationships that stay inside the node's own subtree, so the corpus root shows "No relationships". The Connections pane keeps its own counting.
- The centre signal is a new bus field, and the map shows it as a tint on the selected cell. The design had no picture of this, so I reused the map's existing highlight colouring.
- With nothing chosen, the panel isn't drawn at all.
- The panel's dragged width is kept in memory only.
- The Connections pane's half of OB-209 is left alone, since that pane is being retired.
- I fixed the two design defects locally rather than copying them.