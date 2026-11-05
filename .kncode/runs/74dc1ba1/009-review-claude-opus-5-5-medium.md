I found nothing that must be fixed, so I recorded PASS with one wording nit. I only read the code; I did not run `npm run verify` or the browser checks.

The ledger would not take my answers to R0-1 and R0-2, because only the reviewer who raised them can answer them. I checked both against the code and both are fixed: the test file's header now names both callers, and the hook's comment says why the viewer's guard is there.

The change matches the card:
- **The guard:** the viewer's path skips the publish with `publishableRoad(road, null, bus.routeSteps)`, passing a literal `null` for the walk. It does not record `lastPublished`, and the dependency list is still `[road, bus.activeWalk, dedup]`.
- **The type:** `PublishedRouteBus` now includes `'routeSteps'`.
- **The editor:** its `dedup` path is unchanged.
- **The hook's comment:** both corrections the card asked for are in.
- **The tests:** the two new viewer cases are there, and the existing "same road, even as a fresh array" case is kept.
- **The browser check:** the optionals toggle and its comment are gone from the #484 draft case.
- **Scope:** nothing outside the card's three files changed.

Must fix:
none

Optional:
none

Nit:
1. `src/state/walk/presented.ts:37`: the doc comment on `publishableRoad` still starts "What the editor should put on the bus". The viewer now calls it too, so the wording covers only one of its two callers.

Assumptions: I checked the browser-check edit only by reading it. Whether the three browser checks pass rests on the run's own verification.

<!-- kncode-findings
{"reports":[{"id":"R1-3","raisedAgain":false,"bucket":"Nit","what":"publishableRoad\u0027s doc comment still begins \u0022What the editor should put on the bus\u0022. The viewer\u0027s no-dedup path now calls it too, with a null walk and the bus\u0027s routeSteps.","file":"src/state/walk/presented.ts","line":37,"breaks":"Wording only. The comment describes one caller of a function that now has two.","failure":null}],"answers":[]}
-->
