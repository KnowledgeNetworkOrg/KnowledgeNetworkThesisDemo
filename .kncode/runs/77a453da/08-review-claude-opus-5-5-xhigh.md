MINOR

The change now does everything the card asks, and the one blocking problem from last round is fixed. The star module, the ring layout the retired Connections pane drew from, is back. It now uses the shared centre helper instead of its own copy. It is also listed in the unused-module guard as deliberately kept, with a reason that matches both recorded rollback notes. What remains are two optional points carried over from last round.

**What I checked, card section by card section:**

- **Unused exports (section 1).** Every symbol the card names is either deleted or kept with a one-line reason. I searched `src/`, `tools/` and `desktop/` by name and found no leftover references to anything deleted, including scripts that load modules by file path. The kept ones each say why they stay:
  - the list of all containers is read by the relations audit test and by a spike browser script;
  - the "delete a saved walk" function is the walk store's delete API;
  - three colour helpers exist for the fill-colour audit;
  - the curved-arrow point function is a measurement aid for two tests.
- **The guard (section 2).** It now also watches the core model and corpus folders, and it no longer counts a test as "using" a module. Its header says plainly that it checks whole files, not individual exports. I checked it independently by tracing every real import path rather than matching file names. Exactly three files go unimported by the app (the star module, the topic-hue rule, and the presenting/fullscreen session file), and the guard lists all three with reasons.
- **Copied helpers (section 3).** The map-centre helper and the two stored-walk checks (`isObj`, `isTopic`) each now live in one shared place. The design side's time formatter is left alone, as the card says.

**Commands run this session:**
- Type check plus production build (`npm run build`): passed.
- Linter (`eslint .`): no problems.
- Full test suite: 818 of 818 tests passed in 60 files. That is last round's 797 plus the 21 restored star tests.
- Not run: the desktop type check (the desktop folder's packages are not installed), and a visual check in the running app.

Must fix:
none

Optional:
1. **A third copy of the centre formula is still written out by hand** (`src/instruments/ContoursView.tsx:124-125`). The Contours view averages its group members' positions inline to place its group labels. The card's table doesn't list it, and the card says only "the copies outside #69 share one helper". Contours sits in the Studio's map family beside the parked Unfold views. I still couldn't confirm it is one of #69's parked instruments: the only list in the code that names it also includes screens that are clearly active, like the walk view. If it is not parked, swapping in the shared helper is a two-line change.
2. **The file named "derive" now holds only a point type.** About twenty files import that type from it by that name. Its new header explains the history. The card doesn't require a rename.

Noticed outside this card's scope
- Three comments still describe the retired Connections star as if it were "one pane away":
  - `src/instruments/MapView.tsx:47`
  - `src/model/atlas.ts:286`
  - `src/instruments/map/mapselect.ts:51` ("the star dims its other spokes one pane over")

  These were already noted last round and are left for another card.

Assumptions: I am reviewing as Opus-5.5-unknown, because I can't see my effort level. Git is denied to me, and no neighbouring checkout still holds the retired pane's file. So the claim that the pane imported the star module rests on two things: the two rollback notes (`src/studio/instruments.tsx:225-231` and `src/ds/barrel.test.ts:61-67`), which say that file fed the pane its "star", and the star module's own header. I treated the colour file's trailing blank line, left where `hueOf` was deleted, as cosmetic and didn't raise it.