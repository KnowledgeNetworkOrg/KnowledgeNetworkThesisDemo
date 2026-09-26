PASS

npm ci
npm run verify
npm run build
npx vitest run src/model/storeddata.test.ts
npm run test:browser -- reset
node tools/studio-spike/drive-reset.mjs

**Summary:** Everything passed, and I didn't have to change any code.

The change being checked limits the red "Reset data" button to a named list of saved items, so it no longer erases a presenter's lecture notes. This working copy had no packages installed, so I installed the exact versions the project pins. Then I ran four checks:

- **Full check suite:** the type check, the style check (lint) and all 616 unit tests passed. That includes the six new checks on what Reset clears.
- **Production build:** it succeeded. It printed one warning that the app's main script file is large, but that warning is older than this change and has nothing to do with it.
- **Browser test:** the test that clicks Reset data in a real browser passed. I also ran it directly to watch its individual checks. It planted saved data, pressed Reset, and confirmed three things:
  - The draft, the saved walks and the leftover panel position were deleted.
  - The presenter's notes, categories and deck layout survived exactly as they were.
  - The Connections pane's saved width was cleared.

What this means in practice: pressing Reset data now keeps a presenter's lecture notes and still clears the layout items the card listed.

Two things are still open, and neither blocks the merge:

- **Test data in the wrong shape.** The review noted that the tests save the presenter's categories in a different format from the one the real app writes. That doesn't weaken what the tests prove today, because Reset only looks at the names of saved items, not their contents. I left it alone because this step was only about building and testing, not new work.
- **Leftover files from running things.** Running the checks left a build output folder and two screenshots in the working copy. They are normal byproducts of the build and the browser test.