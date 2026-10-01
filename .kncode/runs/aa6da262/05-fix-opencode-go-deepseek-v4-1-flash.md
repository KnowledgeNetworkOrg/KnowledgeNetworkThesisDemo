Must fix:
1. fixed — `readPersisted` now commits the post-migration, pre-`parse` payload (`writeBack`) instead of the parsed/cleaned value (`src/platform/persisted.ts:189`). Added a generic seam test plus store-level tests: an old unversioned draft (`draftpersist.test.ts`) and an old unversioned saved-walks list (`walkstore.test.ts`) both assert the written-back envelope keeps the members the current reader drops.

Assumptions: I exposed the pre-repair value as a new `writeBack` field on `PersistedRead`, which required updating the two migrated-case assertions in `persisted.test.ts`; the presenter legacy-key path (`lecturenotes.ts:147-153`) is untouched because it belongs to Optional finding 2, not the Must fix.

Noticed outside this card's scope:
- The Optional findings (the "never overwritten" wording, the presenter legacy overwrite, the developer-only report, silent partial repairs, browser drivers unrun, the two lost comment indents in `browsertest-groupedit.mjs`, orphaned keys, and the stale `nav.ts:17` comment) remain by instruction.