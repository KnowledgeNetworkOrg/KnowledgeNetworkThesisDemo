// unreachedmodule.test.ts — every module in the app's own folders is reached by
// something, or says in writing why it is not.
//
// WHY THIS EXISTS. #214 was filed against `src/present/PresentationFrame.tsx`,
// quoting its header and pointing at the early return that mounted it. By the time
// anyone read that issue the file rendered nowhere: #267 replaced the deck with the
// presenter and left the old one standing. So the issue described, in detail and in
// good faith, code that could not run — and the only way to find that out was to grep
// for the filename and notice the silence.
//
// A component nothing renders is worse than clutter. It answers questions wrongly:
// it turns up in searches, it gets read as current, it gets cited in tickets, and its
// comments go on asserting things about an app that has moved on. This is the cheapest
// possible check that it cannot happen quietly again.
//
// It watches the app's own folders — instruments/, present/, studio/, state/, and now
// model/ and corpus/ (#333). It does not police src/ds, where the barrel re-exports
// everything by design and "ported, not yet adopted" is a tracked state with its own
// ledger in barrel.test.ts.
//
// IT CHECKS MODULES, NOT EXPORTS. A live module carrying dead exports passes here by
// design: the question asked is "does anything import this file", not "is every symbol
// in it used". Widening the watch to model/ and corpus/ closes the gap #333 found —
// a whole unreached module could hide there — but an unused export inside a live file
// is still a manual check, not this one's.
//
// A TEST DOES NOT COUNT AS AN IMPORTER (#333). A module whose only reader is its own
// test is not reached by the app: the test proves the rule, it does not put it on
// screen. When such a module is kept on purpose it belongs in KEPT_UNREACHED with the
// reason — `model/topichue.ts` is there for exactly this, and before this rule it was
// invisible here.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const SRC = fileURLToPath(new URL('.', import.meta.url))
const WATCHED = ['instruments', 'present', 'studio', 'state', 'model', 'corpus']

/** Modules that nothing imports ON PURPOSE, each with the reason. Anything here is a
 *  decision somebody made, not an accident nobody noticed — which is the whole
 *  difference this file is trying to make. */
const KEPT_UNREACHED: Record<string, string> = {
  'model/topichue.ts':
    'Topic hue assignment at creation — the rule that a topic is handed the next free ring hue and keeps it ' +
    'through renames. No screen creates a top-level topic yet (the corpus is authored), so its only caller is ' +
    'the test that proves the rule; the header says so. Kept as the single statement of that rule for the day a ' +
    'screen does.',
  'model/star.ts':
    'The relations star — the ring layout the retired Connections pane read. Kept ONLY for #339 (OB-226), which ' +
    'holds the split pane in src/ds for one release so a rollback is restoring `src/instruments/ConnectionsPane.tsx` ' +
    'from d8dd6ce and re-registering it; that file fed on this module, so deleting it would silently add a third ' +
    'step. Delete this entry and the module together with the split pane when the release is over; if the pane is ' +
    'restored, the stale-exception check below flags the entry by itself.',
  'present/session.ts':
    'The presenting/fullscreen split — `presenting` is ours, `fullscreen` is only ever mirrored from the host, ' +
    'because the host can refuse fullscreen and the user can leave it with F11 without walking off stage. ' +
    'PresenterScreen does its own fullscreen and does not use this, but the reasoning is what the Electron ' +
    'slices (#201, #204) need and it reads the platform seam correctly. Kept deliberately; delete it if those ' +
    'slices end up not wanting it.',
}

const modules: string[] = []
const walk = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) modules.push(p)
  }
}
for (const w of WATCHED) walk(join(SRC, w))

/** Everything in src, minus the file being asked about — an import of yourself does
 *  not make you reached. */
const allSources: string[] = []
const walkAll = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkAll(p)
    else if (/\.tsx?$/.test(e.name)) allSources.push(p)
  }
}
walkAll(SRC)
const texts = new Map(allSources.map((f) => [f, readFileSync(f, 'utf8')]))

const key = (abs: string) => relative(SRC, abs).split(sep).join('/')
const isTest = (abs: string) => /\.test\.tsx?$/.test(abs)

describe('every module in instruments/, present/, studio/, state/, model/ and corpus/', () => {
  it('is imported by the app, or is written down as deliberately kept', () => {
    const orphans: string[] = []
    for (const m of modules) {
      const base = m.split(sep).pop()!.replace(/\.tsx?$/, '')
      // an import always ends in the module's own name, whatever the path in front
      const imported = new RegExp(`from\\s+['"][^'"]*(?:^|/)${base}['"]`)
      const bare = new RegExp(`from\\s+['"]\\.{1,2}/${base}['"]`)
      // a test is not the app: only a non-test importer counts as reaching (#333)
      const reached = allSources.some(
        (f) => f !== m && !isTest(f) && (imported.test(texts.get(f)!) || bare.test(texts.get(f)!)),
      )
      if (!reached && !(key(m) in KEPT_UNREACHED)) orphans.push(key(m))
    }
    expect(
      orphans,
      `nothing imports these, so nothing renders them:\n  ${orphans.join('\n  ')}\n` +
        `Delete the module, or add it to KEPT_UNREACHED with the reason. A component that renders ` +
        `nowhere still turns up in searches and still gets cited in tickets as if it were live — that ` +
        `is how #214 came to describe code that could not run.`,
    ).toEqual([])
  })

  it('is not listed as deliberately kept after it has been deleted or wired up', () => {
    const stale: string[] = []
    for (const k of Object.keys(KEPT_UNREACHED)) {
      const abs = join(SRC, ...k.split('/'))
      if (!modules.includes(abs)) {
        stale.push(`${k} — no such module any more`)
        continue
      }
      const base = k.split('/').pop()!.replace(/\.tsx?$/, '')
      const imported = new RegExp(`from\\s+['"][^'"]*(?:^|/)${base}['"]`)
      if (allSources.some((f) => f !== abs && !isTest(f) && imported.test(texts.get(f)!)))
        stale.push(`${k} — something imports it now, so the exception is spent`)
    }
    expect(stale, `KEPT_UNREACHED has gone out of date:\n  ${stale.join('\n  ')}`).toEqual([])
  })
})
