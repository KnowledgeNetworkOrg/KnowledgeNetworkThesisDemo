// #331 — the temporary Reset data pill clears the draft, the saved walks and panel
// layout, and nothing a presenter wrote. It used to sweep every `pkt.` key, and
// presenter mode (#267) saves its lecture notes under that same prefix, so one
// click erased them. The drive-reset browser test presses the real pill; these
// pin the list itself.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearStoredData, listStoredData } from './storeddata'

/** as much of localStorage as storeddata.ts reaches for — the node test
 * environment has none. Returns the backing map, so a test can read what is left */
const stubStore = (seed: Record<string, string>) => {
  const map = new Map(Object.entries(seed))
  vi.stubGlobal('localStorage', {
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  })
  return map
}

/** what Reset owns: one key from each writer, the orphan with no writer left,
 * and both of the Connections pane's layout keys */
const RESET_OWNS: Record<string, string> = {
  'pkt.walkdesk.draft': '{"stops":[],"choices":{},"withOptionals":true}',
  'pkt.walks.saved': '[]',
  'pkt.floating-panel.walk-toolbox': '{"x":40,"y":40,"w":200,"h":300}',
  'kn-connections_leftWidth': '237',
  'kn-connections_collapsed': '1',
}

/** what a presenter wrote — the thing #331 is about */
const LECTURE: Record<string, string> = {
  'pkt.lecture.notes.v1:walk:w7': '{"notes":[{"id":"n1","text":"typed at the lectern","stop":0,"when":"12:04","at":1}],"prepared":{}}',
  'pkt.lecture.notes.v1:draft': '{"notes":[],"prepared":{"s1":"a correction made while teaching"}}',
  'pkt.lecture.categories.v1': '[{"key":"mine","glyph":"!","label":"my own","wash":"red"}]',
  'pkt.lecture.habits.v1': '{"duringWidth":320}',
}

/** not the app's, and not anything Reset was told about */
const OTHERS: Record<string, string> = {
  'some-other-site-key': 'x',
  'pkt.a-feature-from-next-term.v1': '{"typed":"by a person"}',
}

describe('clearStoredData — the Reset data pill', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('clears the draft, the saved walks and panel layout — the orphaned panel rect included', () => {
    const store = stubStore({ ...RESET_OWNS, ...LECTURE, ...OTHERS })
    clearStoredData()
    for (const key of Object.keys(RESET_OWNS)) expect(store.has(key), key).toBe(false)
  })

  it("keeps every one of a presenter's lecture keys, byte for byte", () => {
    const store = stubStore({ ...RESET_OWNS, ...LECTURE, ...OTHERS })
    clearStoredData()
    for (const [key, value] of Object.entries(LECTURE)) expect(store.get(key), key).toBe(value)
  })

  it('reports exactly what it cleared', () => {
    stubStore({ ...RESET_OWNS, ...LECTURE, ...OTHERS })
    expect(clearStoredData().sort()).toEqual(Object.keys(RESET_OWNS).sort())
  })

  it('leaves alone a key it was never told about, even one under pkt.', () => {
    // the list is opt-in: a feature that starts saving tomorrow is safe from
    // this pill until someone adds its prefix on purpose
    const store = stubStore({ ...RESET_OWNS, ...OTHERS })
    clearStoredData()
    for (const [key, value] of Object.entries(OTHERS)) expect(store.get(key), key).toBe(value)
  })
})

describe('listStoredData — what the console shows before a reset', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists every key the app writes, kept and cleared alike, and nothing else', () => {
    stubStore({ ...RESET_OWNS, ...LECTURE, 'some-other-site-key': 'x' })
    const listed = listStoredData().map((e) => e.key)
    expect(listed.sort()).toEqual(Object.keys({ ...RESET_OWNS, ...LECTURE }).sort())
  })

  it('never throws when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(listStoredData()).toEqual([])
    expect(clearStoredData()).toEqual([])
  })
})
