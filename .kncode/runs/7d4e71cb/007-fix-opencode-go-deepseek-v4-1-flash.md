1. In `tools/studio-spike/browsertest-legendinset.mjs`, the Explore step now chooses a topic from the Explorer rail before the Document pane is measured: it opens the rail if it is closed and clicks the first non-root row. That makes the pane show real body text instead of the centred "Nothing chosen" placeholder, which the presenter change correctly left in place. The named failing test now passes (all 7 checks; Document glyph Δ -1.00px).

Assumptions: the topic choice is limited to the Explore preset's collection pass, since that is where the Document pane is first seen, and it reuses the Explorer-rail approach already used by `browsertest-firstline.mjs`.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"C0-1","answer":"Fixed","because":"tools/studio-spike/browsertest-legendinset.mjs: in the explore preset step, a topic is now chosen from the Explorer rail before measuring (open the rail if closed, click the first non-root row), so the Document pane shows its real body text instead of the centred \u0022Nothing chosen\u0022 placeholder. Re-ran the file: all 7 checks pass, Document glyph \u0394 -1.00px.","duplicateOf":null}]}
-->
