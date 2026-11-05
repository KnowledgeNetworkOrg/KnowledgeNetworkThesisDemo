1. R0-1: fixed — check 7 in `tools/studio-spike/browsertest-presenter-start.mjs` now measures the drawn `[data-notes-prepared]` height and chat-column width before and after the drags, asserts both changed, and re-measures them in a live lecture after the reload (prepared 149 → 109, chat 220 → 280, both 109/280 after reload).

Assumptions: the reload re-measurement starts a live lecture rather than reopening the palette preview, because the framed preview is shorter and flex-shrinks the prepared region; the prepared divider is dragged up because dragging down is clamped by the flags pane's minimum height.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"In tools/studio-spike/browsertest-presenter-start.mjs check 7 now measures the drawn [data-notes-prepared] height and the chat column width before the drags, asserts both changed (prepared 149 -\u003E 109, chat 220 -\u003E 280), and after a reload re-measures them in a live lecture (109 and 280), so it no longer relies on the 150/220 defaults or on stored numbers alone. The prepared divider is dragged up, the direction with room, so the drag cannot be clamped to nothing.","duplicateOf":null}]}
-->
