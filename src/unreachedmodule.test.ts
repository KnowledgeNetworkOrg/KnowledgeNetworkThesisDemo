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
// It is deliberately narrow — the three folders that hold this app's own screens. It
// does not police src/ds, where the barrel re-exports everything by design and
// "ported, not yet adopted" is a tracked state with its own ledger in barrel.test.ts.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const SRC = fileURLToPath(new URL('.', import.meta.url))
const WATCHED = ['instruments', 'present', 'studio', 'state']

/** Modules that nothing imports ON PURPOSE, each with the reason. Anything here is a
 *  decision somebody made, not an accident nobody noticed — which is the whole
 *  difference this file is trying to make. */
const KEPT_UNREACHED: Record<string, string> = {
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

describe('every module in instruments/, present/ and studio/', () => {
  it('is imported by something, or is written down as deliberately kept', () => {
    const orphans: string[] = []
    for (const m of modules) {
      const base = m.split(sep).pop()!.replace(/\.tsx?$/, '')
      // an import always ends in the module's own name, whatever the path in front
      const imported = new RegExp(`from\\s+['"][^'"]*(?:^|/)${base}['"]`)
      const bare = new RegExp(`from\\s+['"]\\.{1,2}/${base}['"]`)
      const reached = allSources.some((f) => f !== m && (imported.test(texts.get(f)!) || bare.test(texts.get(f)!)))
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
      if (allSources.some((f) => f !== abs && imported.test(texts.get(f)!)))
        stale.push(`${k} — something imports it now, so the exception is spent`)
    }
    expect(stale, `KEPT_UNREACHED has gone out of date:\n  ${stale.join('\n  ')}`).toEqual([])
  })
})
