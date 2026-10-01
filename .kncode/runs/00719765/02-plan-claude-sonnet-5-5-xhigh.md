**The card asks for a behaviour the design system already ruled out, and that ruling is already built into the app.** I'd get the owner's confirmation before changing any code. I changed nothing and ran nothing in a browser.

**What I found.** The card's description of the current behaviour is out of date. The document pane no longer jumps to the curriculum root. Since the #342 work it shows an empty "Nothing chosen" box, both on first load and after clearing a selection. The design system's own records say this is deliberate:
- **OB-209 clause 4** (owner, 2026-09-17) chose the empty box over a "keep the last page, dimmed" mockup. It says the pane "does NOT keep the last node".
- **OB-260** was cleared on 2026-09-27 with the title "OB-209 wins over OB-240 clause 2". The design project lists OB-240 as DONE, with clause 2 "withdrawn by OB-260". The code side's own receipt for #342 reported the same.

The card, the receipt for #405, and a note in the map-connections browser test all still call the empty box a bug. They appear to have been written without seeing OB-260. The existing relations-rail browser test asserts the empty box after a de-select, so it currently pins the opposite of this card. I couldn't read OB-260's full body because it sits in an archive file too large to fetch. I saw only its title and closing summary.

**Recommendation.** Ask the owner on #386 whether they mean to reverse OB-260. If not, close the card as superseded and correct the stale notes, with no behaviour change. If yes, the plan below delivers the card as written.

1. Gate: the owner confirms this reverses OB-260 and OB-209 clause 4. If not, stop and correct the stale notes only (the map-connections test comment and the card).
2. Write the new browser checks first and run them against today's code to see them fail. These are the three clearing gestures plus the first-load placeholder.
3. Update the relations-rail driver. It replaces the "a de-select empties the pane" block with checks that the page stays, the Explorer pill is off, and the map ring is off. It also covers selecting the cleared node again and selecting a different node.
4. Update the map-connections driver. After Esc, assert the document rests on the node, which is what its own note asks for.
5. In the document pane, keep the last non-empty selection in the pane's own state, set during render. The linter bans setting state in an effect, and the earlier receipt says it also bans reading a ref during render. The node shown becomes: the selection, else a hover preview, else the remembered node, else the placeholder.
6. Rewrite the pane's header comment that says it is empty after a de-select.
7. Run the verification commands below, and confirm the new checks pass now and failed in step 2.
8. After merge, file the receipt in the design project marking OB-240 done. It must say it restores clause 2 and supersedes OB-260 for this case, so the design agent can amend its notes. This writes to the design project, so it needs the owner's go-ahead.

Files: `src/instruments/DocumentPanel.tsx`; `tools/studio-spike/browsertest-relationsrail.mjs`; `tools/studio-spike/browsertest-mapconnections.mjs`; `receipts/<sha>.md` in the design project, after merge.

Out of scope: files under `src/ds/**`, because the card says this is a host change, not a port from the design system. Nothing else is stated.

Verify: select a node from the Explorer rail, and the document pane shows its page. Then clear the selection by each of three gestures: click the selected row, click empty water on the map, and press Esc. After each, the page must stay, while the Explorer pill and the map ring both go off. Selecting the same node again must move the document to it, and a fresh load must still show "Nothing chosen".
```
npm ci --prefix desktop
npm run verify
npm run test:browser -- relationsrail
npm run test:browser -- mapconnections
npm run test:browser -- explorerrail
```

Assumptions:
- The owner confirms the reversal (step 1). Without that, I would not implement.
- First load keeps the "Nothing chosen" placeholder rather than the root page. That answers the card's open question, and it is already how the app behaves.
- The pane remembers the last selection, not the last hover. With nothing selected, hovering a map cell still previews that node over the remembered page. It returns to the remembered page when the cursor leaves.
- The memory lives in the document pane's own state, so a Document pane opened after a selection was cleared starts on the placeholder. `bus.reset()` has no way to clear the memory, and no screen calls it today.
- The Neighborhood pane has the same fall-back to the root page. The card doesn't mention it, so I'd leave it alone.
- The browser tests need Edge installed and the desktop packages from `npm ci --prefix desktop`.