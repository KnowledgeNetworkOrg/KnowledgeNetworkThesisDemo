R0-2 — fixed: in `src/present/PresenterScreen.tsx` the lecture's own route steps and flat ids are now memoised on the stops' ids and optional flags, and `mapBus` reuses those stable arrays, so `useWallFit`'s identity check no longer re-fits every second.

R0-3 — fixed: in `src/studio/StudioView.tsx`, `mintNoteId(Date.now())` is now called once above `setPresenter`, and the updater only stores the resulting `lectureId`; the updater is pure under StrictMode.

Noticed outside this card's scope: the reviewer's note about `QuickActionsDeck` binding `m`/`f`/`e`/`j` and Escape on the document while the start card is open remains true, but it is not part of this card or these findings, so I left it alone.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-2","answer":"Fixed","because":"Memoised the lecture\u0027s own route in PresenterScreen.tsx: ownRouteSteps is built once per ids/flags change and ownRoute from it, so mapBus keeps stable route/routeSteps identities across the once-a-second clock re-renders and useWallFit no longer re-fits.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"Moved mintNoteId(Date.now()) out of the setPresenter updater in StudioView.tsx: startLecture now mints lectureId once above setPresenter and stores that value, so the updater stays pure under StrictMode.","duplicateOf":null}]}
-->
