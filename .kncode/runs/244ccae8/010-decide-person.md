Continue with one more fix round. Must fix 2 isn't a code change: leave it to the check step, which must run all of npm run test:browser, including studiodesk, walkdock, presenter, groupedit, mapconnections, rules-washes-baselines, coursecorpus and the nine drive-* scripts. It must also run studiodesk on base 72206e8 in the same environment and report both results. Skip the two Firefox drivers for the same reason as #415.
▎
▎ Fix Must fix 1 the first way the reviewer suggests: clamp the widths as they're drawn. In dragDesk, call clampDesk on the measured widths (base) directly instead of on fitSizes(...), and compute the handle's deskBounds and aria-valuenow/min/max from those same widths. Don't switch the drawing to fitSizes. That would change the launch layout, and the other drivers must pass unchanged. A pane drawn below its floor just gives nothing up to a drag. Remove fitSizes if nothing uses it any more. In browsertest-deskdividers, add the launch case: 1280×800 with the sidebar open, a small drag on each seam, and assert that only the two panes beside it move, by about the pointer's travel, and that aria-valuenow matches the drawn width before the drag.
▎
▎ Also take optional 5: Walk·Stack stays its fixed 372px, so leave it out of the fraction and drag arithmetic. Take these nits too:
▎ - the em dashes (nit 1);
▎ - move PaneDivider and the JSON-parse test out of the "not adopted" block (nit 2);
▎ - the Slot doc (nit 3);
▎ - PROVENANCE's "cannot disagree" wording (nit 5);
▎ - the receipt's floors list, which should read 240/280/300/372, plus the new launch-drag check in its "Verified" line (nit 6).
▎
▎ Leave optionals 1–4 as they are, and record them in the closing comment. I'll post the #74 drift comment for Pane's fit myself.