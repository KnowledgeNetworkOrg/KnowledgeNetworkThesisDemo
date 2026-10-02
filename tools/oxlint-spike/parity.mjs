// parity.mjs — can oxlint replace ESLint in this repo without anything going dark? (#65)
//
// WHY THIS EXISTS. The card asks for a decision on evidence, and the evidence has to be
// something anyone can reproduce, not a reading of two rule lists. Linting a tree that
// already passes `eslint .` proves almost nothing on its own — both tools report "clean" —
// so there are three kinds of measurement, all of them native-only (see below):
//
//   A. PLANTED VIOLATIONS. One tiny file per family this repo relies on, written to a
//      scratch folder in the OS temp directory — never into the repo, so `npm run lint`
//      can never see them. ESLint runs over it with THIS repo's `eslint.config.js` (so the
//      scoped bans land on the paths they are scoped to); oxlint runs with every category
//      and plugin on, the most generous setting there is. An ESLint cell that says
//      "silent" means the planted code is wrong, not that ESLint is — the verdict is then
//      TEST INVALID.
//   B. RULE INVENTORY. Every rule `eslint --print-config` says is active for a src .tsx
//      file, checked by name against `oxlint --rules`, and then against what
//      `@oxlint/migrate` actually carried across from `eslint.config.js`. Names only: a
//      same-named rule can still behave differently, which is why A exists.
//   D. THE REAL TREE, TOOL AGAINST TOOL. The card's "diff its findings against
//      `eslint .`". oxlint gets the config `@oxlint/migrate` writes from
//      `eslint.config.js` — a setup comparable to ESLint's, where "every rule on" would
//      be noise — and is run over a COPY of the repo's lintable files, because oxlint
//      reads the config's per-folder overrides relative to where the config sits and the
//      repo must not gain a config file. Two copies: one as it is, and one with every
//      `eslint-disable` turned into `eslint_disable` (same line numbers, nothing to
//      obey). ESLint runs over the real tree plain and over the same renamed copy (not
//      `--no-inline-config`: that flag stops ESLint obeying the comments, but the React-
//      compiler rules in eslint-plugin-react-hooks read the comment text themselves and
//      skip a function that holds a disable, so they would under-report). That
//      gives, per rule and per file, what each tool reports with and without the
//      repo's disable comments — and, for each comment, whether the rule it silences
//      really fires on that line (ESLint) and whether oxlint's rule fires there too.
//
// NATIVE RULES ONLY. oxlint can also be pointed at ESLint plugins and run them, but that
// keeps the ESLint packages installed, and the card's step 3 is to drop them. A rule that
// only fires through an ESLint plugin is not parity; plugins in the migrated config are
// stripped, and rules oxlint does not know are dropped, both recorded in the report.
//
// oxlint and @oxlint/migrate are installed into a temp folder and never added to
// package.json. The one thing the script writes inside the repo folder is the migrate
// tool's output, a temporary file under node_modules/.cache/oxlint-parity/ that is
// removed as soon as it is read (the tool joins its output path onto its own folder, so
// the file cannot go elsewhere).
//
// Run:  node tools/oxlint-spike/parity.mjs           — print the tables
//       node tools/oxlint-spike/parity.mjs --write   — also write them into RESULTS.md
//       node tools/oxlint-spike/parity.mjs --keep    — leave the temp folder for inspection
// Env:  OXLINT_VERSION=1.2.3          pins oxlint (default: latest; the run records which)
//       OXLINT_MIGRATE_VERSION=1.2.3  pins @oxlint/migrate (default: latest)
//       OXLINT_BIN=<path>             uses an oxlint launcher already on disk
// Needs `npm ci` first, for the repo's own ESLint. Exit 2 means the harness could not
// measure everything (or the planted test is invalid); 0 means it measured, whatever the
// verdict is.
import {
  closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const RESULTS = join(HERE, 'RESULTS.md')
const BEGIN = '<!-- parity:begin -->'
const END = '<!-- parity:end -->'

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const KEEP = args.includes('--keep')
const VERSION = process.env.OXLINT_VERSION ?? 'latest'
const MIGRATE_VERSION = process.env.OXLINT_MIGRATE_VERSION ?? 'latest'

const fail = (message) => { throw new Error(message) }
const rel = (f) => f.replace(/\\/g, '/').replace(/^\.\//, '')
const cell = (s) => String(s).replace(/\|/g, '\\|')
const findings = (n) => `${n} finding${n === 1 ? '' : 's'}`
const shortName = (id) => id.slice(id.lastIndexOf('/') + 1)
const tail = (r, n = 8) =>
  `${r.error ? `${r.error}\n` : ''}${(r.stderr || r.stdout || '').trim().split('\n').slice(-n).map((l) => l.slice(0, 300)).join('\n')}`

// ---- the planted violations ---------------------------------------------------------
// `eslint` decides whether a message from ESLint is the one we planted for; `oxlint` is
// matched against oxlint's `code` ("scope(rule-name)"). Every code oxlint reports in the
// planted file is printed too, so a rule that is present under another name is visible.
const FAMILIES = [
  {
    key: 'exhaustive-deps',
    what: 'an effect that reads `step` but lists no dependencies',
    file: 'src/plant-exhaustive-deps.tsx',
    code: `import { useEffect, useState } from 'react'
export function Counter({ step }: { step: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((v) => v + step), 1000)
    return () => clearInterval(id)
  }, [])
  return <span>{n}</span>
}
`,
    eslint: (m) => m.ruleId === 'react-hooks/exhaustive-deps',
    oxlint: /exhaustive-deps/,
  },
  {
    key: 'rules-of-hooks',
    what: 'a hook called inside an `if`',
    file: 'src/plant-rules-of-hooks.tsx',
    code: `import { useState } from 'react'
export function Maybe({ on }: { on: boolean }) {
  if (on) {
    const [n] = useState(0)
    return <span>{n}</span>
  }
  return null
}
`,
    eslint: (m) => m.ruleId === 'react-hooks/rules-of-hooks',
    oxlint: /rules-of-hooks/,
  },
  {
    key: 'set-state-in-effect',
    what: 'a state setter called straight inside an effect body',
    file: 'src/plant-set-state-in-effect.tsx',
    code: `import { useEffect, useState } from 'react'
export function Mirror() {
  const [copy, setCopy] = useState(0)
  useEffect(() => {
    setCopy(1)
  }, [])
  return <span>{copy}</span>
}
`,
    eslint: (m) => m.ruleId === 'react-hooks/set-state-in-effect',
    oxlint: /set-state-in-effect/,
  },
  {
    key: 'refs',
    what: 'a ref read during render',
    file: 'src/plant-refs.tsx',
    code: `import { useRef } from 'react'
export function Peek() {
  const ref = useRef(0)
  return <span>{ref.current}</span>
}
`,
    eslint: (m) => m.ruleId === 'react-hooks/refs',
    oxlint: /\(refs\)|ref.*render/,
  },
  {
    key: 'immutability',
    what: 'a property of a prop assigned to during render',
    file: 'src/plant-immutability.tsx',
    code: `export function Mutate({ cfg }: { cfg: { n: number } }) {
  cfg.n = 2
  return <span>{cfg.n}</span>
}
`,
    eslint: (m) => m.ruleId === 'react-hooks/immutability',
    oxlint: /immutability/,
  },
  {
    key: 'only-export-components',
    what: 'a component file that also exports a plain function',
    file: 'src/plant-only-export-components.tsx',
    code: `export function helper() {
  return 1
}
export function Box() {
  return <div>{helper()}</div>
}
`,
    eslint: (m) => m.ruleId === 'react-refresh/only-export-components',
    oxlint: /only-export-components/,
  },
  {
    key: 'host-branch (#211)',
    what: '`platform.name === \'electron\'` anywhere under src/',
    file: 'src/plant-host-branch.ts',
    code: `declare const platform: { name: string }
export const isElectron = platform.name === 'electron'
`,
    eslint: (m) => m.ruleId === 'no-restricted-syntax' && /host-shaped/.test(m.message),
    oxlint: /restricted-syntax/,
  },
  {
    key: 'raw hex / px (#61)',
    what: 'a raw `#ff0000` and `10px` in src/App.tsx (one of the three scoped files)',
    file: 'src/App.tsx',
    code: `export function App() {
  return <div style={{ color: '#ff0000', width: '10px' }} />
}
`,
    eslint: (m) => m.ruleId === 'no-restricted-syntax' && /raw (hex|px)/.test(m.message),
    oxlint: /restricted-syntax/,
  },
  {
    key: 'recommended: no-debugger',
    what: 'a `debugger` statement (core recommended)',
    file: 'src/plant-no-debugger.ts',
    code: `export function stop() {
  debugger
}
`,
    eslint: (m) => m.ruleId === 'no-debugger',
    oxlint: /no-debugger/,
  },
  {
    key: 'recommended: no-explicit-any',
    what: 'an `any` type (typescript-eslint recommended)',
    file: 'src/plant-no-explicit-any.ts',
    code: `export const echo = (x: any) => x
`,
    eslint: (m) => m.ruleId === '@typescript-eslint/no-explicit-any',
    oxlint: /no-explicit-any/,
  },
  {
    key: 'recommended: no-unused-vars',
    what: 'a local that is never used (typescript-eslint recommended)',
    file: 'src/plant-no-unused-vars.ts',
    code: `export function f() {
  const unused = 1
}
`,
    eslint: (m) => m.ruleId === '@typescript-eslint/no-unused-vars',
    oxlint: /no-unused-vars/,
  },
]

// Every category and every plugin that does not need a framework we do not use: the
// most rules oxlint can bring to bear, so a "silent" cell is not a config omission.
const OXLINT_CONFIG = {
  plugins: ['react', 'typescript', 'unicorn', 'oxc', 'import', 'jsx-a11y', 'react-perf'],
  categories: Object.fromEntries(
    ['correctness', 'suspicious', 'pedantic', 'perf', 'style', 'restriction', 'nursery'].map((c) => [c, 'error']),
  ),
}

// ---- tool plumbing ------------------------------------------------------------------
const eslintBin = join(REPO, 'node_modules', 'eslint', 'bin', 'eslint.js')

const isNodeScript = (file) => {
  if (/\.[cm]?js$/.test(file)) return true
  const fd = openSync(file, 'r')
  const buf = Buffer.alloc(64)
  readSync(fd, buf, 0, 64, 0)
  closeSync(fd)
  return /^#!.*\bnode\b/.test(buf.toString('latin1'))
}

const launch = (launcher, a, cwd) => {
  const [cmd, pre] = isNodeScript(launcher) ? [process.execPath, [launcher]] : [launcher, []]
  return spawnSync(cmd, [...pre, ...a], { cwd, encoding: 'utf8', maxBuffer: 1 << 29 })
}

// oxlint is required; @oxlint/migrate is not — without it the real-tree comparison cannot
// run, but the planted-violation table still can, so its failure is recorded, not thrown.
const installTools = (root) => {
  const dir = join(root, 'tools')
  mkdirSync(dir)
  writeFileSync(join(dir, 'package.json'), '{"private":true}\n')
  const install = (spec) =>
    spawnSync(`npm install ${spec} --no-audit --no-fund --loglevel=error`, { cwd: dir, shell: true, encoding: 'utf8' })
  const installed = (name) => {
    const pkgDir = join(dir, 'node_modules', ...name.split('/'))
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    const bin = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin?.[name] ?? Object.values(pkg.bin ?? {})[0])
    if (!bin) fail(`${name} declares no executable`)
    return { launcher: join(pkgDir, bin), version: pkg.version }
  }

  const tools = { oxlint: null, oxlintVersion: null, migrate: null, migrateVersion: null, migrateError: null }
  if (process.env.OXLINT_BIN) {
    tools.oxlint = resolve(process.env.OXLINT_BIN)
  } else {
    const r = install(`oxlint@${VERSION}`)
    if (r.status !== 0) fail(`could not install oxlint@${VERSION}:\n${tail(r)}`)
    const o = installed('oxlint')
    tools.oxlint = o.launcher
    tools.oxlintVersion = o.version
  }
  const m = install(`@oxlint/migrate@${MIGRATE_VERSION}`)
  if (m.status !== 0) {
    tools.migrateError = `could not install @oxlint/migrate@${MIGRATE_VERSION}:\n${tail(m)}`
  } else {
    try {
      const o = installed('@oxlint/migrate')
      tools.migrate = o.launcher
      tools.migrateVersion = o.version
    } catch (e) {
      tools.migrateError = e.message
    }
  }
  return tools
}

const diagnosticsOf = (r, what) => {
  let parsed
  try {
    parsed = JSON.parse(r.stdout)
  } catch {
    fail(`oxlint gave no JSON for ${what} (exit ${r.status}):\n${tail(r)}`)
  }
  return Array.isArray(parsed) ? parsed : (parsed.diagnostics ?? [])
}

// Both tools' findings reduced to the same shape: { file, line, rule } with the rule as
// its short name ("exhaustive-deps"), whatever plugin or scope prefix each tool gives it.
const fromOxlint = (diags) => {
  const out = diags.map((d) => ({
    file: rel(d.filename ?? ''),
    line: d.labels?.[0]?.span?.line ?? 0,
    rule: /\(([^)]+)\)\s*$/.exec(d.code ?? '')?.[1] ?? null,
  }))
  if (out.length && out.every((x) => !x.line)) {
    fail('oxlint reported findings but its JSON carries no line numbers, so nothing can be matched to a disable comment')
  }
  return out
}

const eslintOnTree = (extra, cwd = REPO) => {
  const r = spawnSync(process.execPath, [eslintBin, '.', '--format', 'json', ...extra], {
    cwd, encoding: 'utf8', maxBuffer: 1 << 29,
  })
  let files
  try { files = JSON.parse(r.stdout) } catch { fail(`eslint gave no JSON over ${cwd === REPO ? 'the real tree' : 'the renamed copy'} (exit ${r.status}):\n${tail(r)}`) }
  return files.flatMap((f) => f.messages.map((m) => ({
    file: rel(relative(cwd, f.filePath)),
    line: m.line ?? 0,
    rule: m.ruleId ? shortName(m.ruleId) : null,
    severity: m.severity,
    unused: /^Unused eslint-disable directive/.test(m.message ?? ''),
  })))
}

const severity = (v) => {
  const s = Array.isArray(v) ? v[0] : v
  return s === 'error' ? 2 : s === 'warn' ? 1 : s === 'off' ? 0 : Number(s)
}

const isOn = (v) => !['off', 'allow', 0, '0'].includes(Array.isArray(v) ? v[0] : v)

// The same files `eslint .` reads: everything under the repo bar the folders ESLint (or
// this repo's config) ignores (`globalIgnores` in eslint.config.js: dist, desktop/release,
// .venv).
const walk = (dir, visit) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.venv', 'dist', '.git'].includes(e.name)) continue
    const p = join(dir, e.name)
    if (p === join(REPO, 'desktop', 'release')) continue
    if (e.isDirectory()) walk(p, visit)
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(e.name)) visit(p)
  }
}

// A copy of the lintable tree. `neutralise` rewrites every `eslint-disable` to
// `eslint_disable` (and every `eslint-enable` with it, or ESLint would report each one as
// closing nothing): the same line numbers, so what a tool reports lines up with the
// comment's target, and nothing for either tool to obey.
const copyTree = (dest, neutralise) => {
  walk(REPO, (file) => {
    const to = join(dest, relative(REPO, file))
    mkdirSync(dirname(to), { recursive: true })
    const text = readFileSync(file, 'utf8')
    writeFileSync(to, neutralise ? text.replace(/eslint-(disable|enable)/g, 'eslint_$1') : text)
  })
}

// ESLint over a copy made by `copyTree`, with this repo's own config. This, not
// `--no-inline-config`, is what "comments neutralised" has to mean for ESLint: that flag
// stops ESLint OBEYING the comments, but the react-hooks plugin's React-compiler pass
// reads the comment text itself and skips any function holding a `react-hooks/…` disable,
// so those rules (`refs`, `immutability`, `use-memo`, part of `set-state-in-effect`)
// would report fewer findings than the code has, and oxlint's copy (nothing left to read)
// would look as if it found more. The repo's own config is handed over with `-c`: ESLint
// then takes the working folder (the copy) as the base its `files` patterns are matched
// against, and the plugins resolve from the config's own folder, so the copy needs no
// config, no package.json and no link to node_modules.
const eslintOnCopy = (dir) => eslintOnTree(['-c', join(REPO, 'eslint.config.js')], dir)

// Every `eslint-disable…` comment in the real .ts/.tsx files, as the lines it silences:
// `-next-line` is the line after the comment ENDS (several are multi-line block
// comments), `-line` is its own line, and a plain `/* eslint-disable x */` runs to the
// matching `eslint-enable` (or the end of the file).
const readDirectives = () => {
  const found = []
  walk(REPO, (file) => {
    if (!/\.tsx?$/.test(file)) return
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    const events = []
    lines.forEach((text, i) => {
      const m = /(\/\/|\/\*)\s*eslint-(disable|enable)(-next-line|-line)?(?=\s|\*\/|$)(.*)$/.exec(text)
      if (!m) return
      let end = i
      if (m[1] === '/*') {
        while (end < lines.length - 1 && !lines[end].includes('*/', end === i ? m.index + 2 : 0)) end++
      }
      const rules = m[4].replace(/\*\/.*$/, '').split(/\s+--(?:\s|$)/)[0].split(',').map((s) => s.trim()).filter(Boolean)
      events.push({ kind: m[2], scope: m[3] ?? '', rules: rules.length ? rules : ['*'], line: i + 1, end: end + 1 })
    })
    events.forEach((e, k) => {
      if (e.kind !== 'disable') return
      let from
      let to
      if (e.scope === '-next-line') {
        from = to = e.end + 1
      } else if (e.scope === '-line') {
        from = to = e.line
      } else {
        from = e.end
        to = Infinity
        const closer = events.slice(k + 1).find((x) =>
          x.kind === 'enable' && x.scope === '' && (x.rules.includes('*') || x.rules.some((r) => e.rules.includes(r))))
        if (closer) to = closer.line
      }
      found.push({ file: rel(relative(REPO, file)), line: e.line, rules: e.rules, from, to })
    })
  })
  return found
}

// ---- the real-tree comparison -------------------------------------------------------
const countBy = (list, keep) => {
  const m = new Map()
  for (const x of list) {
    if (!keep(x)) continue
    const k = x.rule ?? '(no rule id)'
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

// Where `a` has more findings of one (file, rule) than `b` does.
const surplus = (a, b) => {
  const tally = (list) => {
    const m = new Map()
    for (const x of list) {
      const k = `${x.file}\u0000${x.rule ?? '(no rule id)'}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }
  const bm = tally(b)
  return [...tally(a)]
    .map(([k, n]) => ({ file: k.split('\u0000')[0], rule: k.split('\u0000')[1], n: n - (bm.get(k) ?? 0) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n || x.file.localeCompare(y.file))
}

const summariseEslint = (esActive, esNeutral) => {
  const real = esActive.filter((x) => !x.unused)
  return {
    errors: real.filter((x) => x.severity === 2).length,
    warnings: real.filter((x) => x.severity !== 2).length,
    unused: esActive.filter((x) => x.unused).length,
    byRule: countBy(esActive, (x) => !x.unused),
    suppressed: esNeutral.filter((x) => !x.unused).length,
  }
}

const compareWithOxlint = ({ directives, esActive, esNeutral, oxActive, oxNeutral }) => {
  const covers = (d, x) => x.file === d.file && x.line >= d.from && x.line <= d.to
  const byRule = new Map()
  let stale = 0
  let confirmed = 0
  let silentComments = 0
  let movedComments = 0
  for (const d of directives) {
    for (const raw of d.rules) {
      const rule = raw === '*' ? '*' : shortName(raw)
      const is = (x) => rule === '*' || x.rule === rule
      let state
      if (!esNeutral.some((x) => covers(d, x) && is(x))) state = 'stale'
      else if (oxNeutral.some((x) => covers(d, x) && is(x))) state = 'fires'
      else if (!oxNeutral.some((x) => x.file === d.file && is(x))) state = 'silent'
      // oxlint reports the rule in this file, but not on the line ESLint does. Whether the
      // comment would have to move is then decided by the run with the comments IN PLACE:
      // if oxlint still reports the rule in the file, the comment does not cover it
      // ('elsewhere'); if it is quiet, the comment still silences it where it stands
      // ('held') and only the position of oxlint's first mark differs. Per file and rule,
      // so a file with several comments for one rule is judged as a whole.
      else state = oxActive.some((x) => x.file === d.file && is(x)) ? 'elsewhere' : 'held'
      const t = byRule.get(rule) ?? { comments: 0, stale: 0, fires: 0, held: 0, elsewhere: 0, silent: 0 }
      t.comments++
      t[state]++
      byRule.set(rule, t)
      if (state === 'stale') {
        stale++
      } else {
        confirmed++
        if (state === 'silent') silentComments++
        else if (state === 'elsewhere') movedComments++
      }
    }
  }

  const esN = countBy(esNeutral, (x) => !x.unused)
  const oxN = countBy(oxNeutral, () => true)
  const perRule = [...new Set([...esN.keys(), ...oxN.keys()])]
    .map((rule) => ({ rule, es: esN.get(rule) ?? 0, ox: oxN.get(rule) ?? 0 }))
    .sort((a, b) => b.es - a.es || a.rule.localeCompare(b.rule))
  const extra = surplus(oxActive, esActive.filter((x) => !x.unused))
  return {
    byRule,
    stale,
    confirmed,
    silentComments,
    movedComments,
    perRule,
    dark: perRule.filter((r) => r.es > 0 && r.ox === 0).map((r) => r.rule),
    fewer: surplus(esNeutral.filter((x) => !x.unused), oxNeutral),
    extra,
    extraTotal: extra.reduce((a, x) => a + x.n, 0),
    oxActiveTotal: oxActive.length,
  }
}

// ---- the run ------------------------------------------------------------------------
const measure = () => {
  if (!existsSync(eslintBin)) fail('eslint is not installed here — run `npm ci` first')
  if (!/^[\w.-]+$/.test(VERSION)) fail(`OXLINT_VERSION must look like 1.2.3 or latest, not "${VERSION}"`)
  if (!/^[\w.-]+$/.test(MIGRATE_VERSION)) fail(`OXLINT_MIGRATE_VERSION must look like 1.2.3 or latest, not "${MIGRATE_VERSION}"`)

  const root = mkdtempSync(join(tmpdir(), 'oxlint-parity-'))
  try {
    const scratch = join(root, 'scratch')
    mkdirSync(join(scratch, 'src'), { recursive: true })
    for (const f of FAMILIES) writeFileSync(join(scratch, f.file), f.code)
    const cfg = join(root, 'oxlintrc.json')
    writeFileSync(cfg, `${JSON.stringify(OXLINT_CONFIG, null, 2)}\n`)

    const tools = installTools(root)
    const oxlint = (a, cwd) => launch(tools.oxlint, a, cwd)
    // `-c` makes ESLint take its base path from the cwd, so the scratch files sit at
    // `src/...` exactly where the config's globs are written for the repo.
    const eslint = (a) =>
      spawnSync(process.execPath, [eslintBin, '-c', join(REPO, 'eslint.config.js'), ...a], {
        cwd: scratch, encoding: 'utf8', maxBuffer: 1 << 28,
      })

    const versions = {
      node: process.version,
      eslint: JSON.parse(readFileSync(join(REPO, 'node_modules', 'eslint', 'package.json'), 'utf8')).version,
      oxlint: tools.oxlintVersion ?? (oxlint(['--version'], scratch).stdout || '').match(/\d+\.\d+\.\d+\S*/)?.[0] ?? 'unknown',
      migrate: tools.migrateVersion ?? 'not installed',
    }

    // A. planted violations
    const er = eslint(['--format', 'json', 'src'])
    let eslintFiles
    try { eslintFiles = JSON.parse(er.stdout) } catch { fail(`eslint gave no JSON (exit ${er.status}):\n${tail(er)}`) }
    const or = oxlint(['-c', cfg, '--format', 'json', 'src'], scratch)
    const oxDiags = diagnosticsOf(or, 'the planted files')
    const here = (name) => (n) => rel(n) === name || rel(n).endsWith(`/${name}`)
    const rows = FAMILIES.map((f) => {
      const msgs = eslintFiles.find((e) => here(f.file)(e.filePath))?.messages ?? []
      const mine = msgs.filter(f.eslint)
      const all = oxDiags.filter((d) => here(f.file)(d.filename ?? ''))
      const theirs = all.filter((d) => f.oxlint.test(d.code ?? ''))
      const codes = (list) => [...new Set(list)].filter(Boolean)
      return {
        ...f,
        eslintHit: mine.length > 0,
        eslintCell: mine.length ? `fires (${codes(mine.map((m) => m.ruleId)).join(', ')})` : 'SILENT',
        oxHit: theirs.length > 0,
        oxCell: theirs.length
          ? `fires (${codes(theirs.map((d) => d.code)).join(', ')})`
          : `SILENT${all.length ? ` — other rules reported here: ${codes(all.map((d) => d.code)).slice(0, 4).join(', ')}` : ''}`,
      }
    })

    // B. rule inventory — by name against oxlint, then against what migrate carried over
    const pc = eslint(['--print-config', 'src/plant-exhaustive-deps.tsx'])
    // Without --format, a piped `oxlint --rules` prints nothing at all; json is the stable form.
    const rl = oxlint(['--rules', '--format', 'json', '-c', cfg], scratch)
    const oxRules = new Map()
    try {
      for (const r of JSON.parse(rl.stdout)) oxRules.set(r.value, [...(oxRules.get(r.value) ?? []), r.scope])
    } catch { /* oxRules stays empty and the inventory reports itself unavailable */ }
    let active = null
    let inventory
    if (pc.status === 0 && oxRules.size > 0) {
      active = Object.entries(JSON.parse(pc.stdout).rules ?? {})
        .filter(([, v]) => severity(v) > 0)
        .map(([n]) => n)
      inventory = {
        total: active.length,
        oxTotal: oxRules.size,
        missing: active.filter((n) => !oxRules.has(shortName(n))),
        notMigrated: null,
      }
    } else {
      inventory = { unavailable: `eslint --print-config exit ${pc.status}; oxlint --rules listed ${oxRules.size} rules (exit ${rl.status})\n${tail(rl)}` }
    }

    // The config oxlint is given for the real-tree comparison: what @oxlint/migrate makes
    // of eslint.config.js, restricted to native rules (see the header).
    const migrate = () => {
      if (!tools.migrate) fail(tools.migrateError)
      // migrate glues its argument and --output-file onto its own working folder, so an
      // absolute path comes out as "<folder>/D:/..." and is never found. Both are given
      // relative to the repo, and the output goes under node_modules/.cache (not linted,
      // not tracked) and is removed straight after it is read.
      const outRel = join('node_modules', '.cache', 'oxlint-parity', 'oxlintrc.json')
      const outDir = dirname(join(REPO, outRel))
      mkdirSync(outDir, { recursive: true })
      const r = launch(tools.migrate, ['eslint.config.js', '--output-file', outRel], REPO)
      const written = existsSync(join(REPO, outRel)) ? readFileSync(join(REPO, outRel), 'utf8') : null
      rmSync(outDir, { recursive: true, force: true })
      if (written === null) fail(`@oxlint/migrate wrote no config (exit ${r.status})\n${tail(r, 12)}`)
      const config = JSON.parse(written)
      const parts = [config, ...(config.overrides ?? [])]
      const jsPlugins = parts
        .flatMap((c) => c.jsPlugins ?? [])
        .map((p) => (typeof p === 'string' ? p : (p.name ?? p.specifier ?? JSON.stringify(p))))
      for (const c of parts) delete c.jsPlugins
      // Only prune when the `--rules` parse is trustworthy (it knows a rule every oxlint has).
      const pruned = []
      if (oxRules.has('no-debugger')) {
        for (const c of parts) {
          for (const k of Object.keys(c.rules ?? {})) {
            if (!oxRules.has(shortName(k))) {
              pruned.push(k)
              delete c.rules[k]
            }
          }
        }
      }
      const carried = new Set(parts.flatMap((c) => Object.entries(c.rules ?? {}).filter(([, v]) => isOn(v)).map(([k]) => shortName(k))))
      return { config, jsPlugins, pruned, carried, said: tail(r, 12) }
    }
    let migrated
    try {
      migrated = migrate()
    } catch (e) {
      migrated = { unavailable: e.message }
    }
    if (migrated.carried && active) {
      const missingSet = new Set(inventory.missing)
      inventory.notMigrated = active.filter((n) => !migrated.carried.has(shortName(n)) && !missingSet.has(n))
    }

    // D. the real tree. ESLint's side does not need migrate, so it is measured first and
    // stands on its own if oxlint's side cannot run.
    let real
    try {
      const directives = readDirectives()
      // two copies of the lintable files: as they are, and with every `eslint-disable`
      // rewritten so there is nothing to obey (or, for the React-compiler pass, to read)
      const plainDir = join(root, 'tree-plain')
      const neutralDir = join(root, 'tree-neutral')
      copyTree(plainDir, false)
      copyTree(neutralDir, true)
      const esActive = eslintOnTree([])
      const esNeutral = eslintOnCopy(neutralDir)
      real = { directives, es: summariseEslint(esActive, esNeutral), ox: null, oxError: null }
      try {
        if (migrated.unavailable) fail(migrated.unavailable)
        const onCopy = (dir, what) => {
          writeFileSync(join(dir, '.oxlintrc.json'), `${JSON.stringify(migrated.config, null, 2)}\n`)
          const r = oxlint(['-c', '.oxlintrc.json', '--format', 'json', '.'], dir)
          return fromOxlint(diagnosticsOf(r, `the ${what} copy of the real tree`))
        }
        const oxActive = onCopy(plainDir, 'plain')
        const oxNeutral = onCopy(neutralDir, 'comment-neutralised')
        real.ox = compareWithOxlint({ directives, esActive, esNeutral, oxActive, oxNeutral })
      } catch (e) {
        real.oxError = e.message
      }
    } catch (e) {
      real = { unavailable: e.message }
    }

    return { versions, rows, inventory, migrated, real }
  } finally {
    if (KEEP) console.error(`kept ${root}`)
    else rmSync(root, { recursive: true, force: true })
  }
}

// ---- the report ---------------------------------------------------------------------
const listed = (items, show = 15) => [
  ...items.slice(0, show).map((x) => `- \`${x.file}\` — \`${x.rule}\`: ${x.n}`),
  ...(items.length > show ? [`- … and ${items.length - show} more`] : []),
]

const report = ({ versions, rows, inventory, migrated, real }) => {
  const invalid = rows.filter((r) => !r.eslintHit)
  const silent = rows.filter((r) => !r.oxHit)
  const missing = inventory.missing ?? []
  const notMigrated = inventory.notMigrated ?? []
  const cmp = real.ox
  const incomplete = !!(inventory.unavailable || real.unavailable || real.oxError)

  let verdict
  if (invalid.length) {
    verdict = `TEST INVALID — ESLint did not report the planted violation for: ${invalid.map((r) => r.key).join(', ')}. The planted code or the harness is wrong, not oxlint.`
  } else {
    const gaps = []
    if (silent.length) gaps.push(`${silent.length} of ${rows.length} planted violations oxlint does not report (${silent.map((r) => r.key).join(', ')})`)
    if (missing.length) gaps.push(`${missing.length} active ESLint rules with no same-named oxlint rule`)
    if (notMigrated.length) gaps.push(`${notMigrated.length} active ESLint rules that @oxlint/migrate did not carry into the oxlint config`)
    if (migrated.jsPlugins?.length) gaps.push(`@oxlint/migrate left ${migrated.jsPlugins.length} ESLint plugin(s) in the config (${migrated.jsPlugins.join(', ')}), which would have to stay installed`)
    if (cmp?.dark.length) gaps.push(`${cmp.dark.length} rules ESLint reports on the real tree that oxlint does not (${cmp.dark.join(', ')})`)
    if (cmp?.silentComments > 0) gaps.push(`${cmp.silentComments} of ${cmp.confirmed} disable comments cover a rule that oxlint never reports in that file`)
    if (cmp?.movedComments > 0) gaps.push(`${cmp.movedComments} of ${cmp.confirmed} disable comments would have to move, because oxlint reports the same rule on a different line of the file and still reports it there with the comments in place`)
    if (cmp?.fewer.length) gaps.push(`ESLint reports more than oxlint in ${cmp.fewer.length} file/rule pairs (${[...new Set(cmp.fewer.map((x) => x.rule))].join(', ')})`)
    if (cmp?.extraTotal > 0) gaps.push(`oxlint reports ${findings(cmp.extraTotal)} on the real tree that ESLint does not`)
    if (gaps.length) {
      verdict = `KEEP ESLINT — ${gaps.join('; ')}.`
    } else if (incomplete) {
      verdict = 'INCONCLUSIVE — every planted violation fires in both tools, but the inventory or the real-tree comparison could not run (see below).'
    } else {
      verdict = `PARITY HOLDS — all ${rows.length} planted violations fire in both tools, every active ESLint rule is carried into the oxlint config, every disable comment's rule fires on its line in both, and the two tools agree on the real tree.`
    }
  }

  const md = []
  md.push(`**Verdict: ${verdict}**`, '')
  md.push(`Measured ${new Date().toISOString().slice(0, 10)} with oxlint ${versions.oxlint}, @oxlint/migrate ${versions.migrate}, eslint ${versions.eslint}, node ${versions.node}.`, '')

  md.push('#### A. One planted violation per rule family', '')
  md.push('| family | what is planted | ESLint (this repo\'s config) | oxlint (native rules, everything on) |', '| --- | --- | --- | --- |')
  for (const r of rows) md.push(`| ${cell(r.key)} | ${cell(r.what)} | ${cell(r.eslintCell)} | ${cell(r.oxCell)} |`)
  md.push('')

  md.push('#### B. Active ESLint rules oxlint cannot run, or that the migrated config dropped', '')
  if (inventory.unavailable) {
    md.push(`Could not run: ${inventory.unavailable}`)
  } else {
    md.push(`ESLint has ${inventory.total} rules active for a \`src\` .tsx file; oxlint lists ${inventory.oxTotal} rules.`, '')
    md.push(missing.length ? 'No same-named oxlint rule exists for:' : 'Every active ESLint rule has a same-named oxlint rule.')
    for (const n of missing) md.push(`- \`${n}\``)
    md.push('')
    if (inventory.notMigrated) {
      md.push(notMigrated.length ? 'oxlint has the rule, but `@oxlint/migrate` did not put it in the config it wrote:' : 'Every other active ESLint rule is in the config `@oxlint/migrate` wrote.')
      for (const n of notMigrated) md.push(`- \`${n}\``)
    } else {
      md.push(`Whether the migrated config carries them: not checked (${migrated.unavailable ?? 'no migrated config'}).`)
    }
  }
  md.push('')

  md.push('#### C. The config `@oxlint/migrate` made from `eslint.config.js`', '')
  if (migrated.unavailable) {
    md.push(`Could not run: ${migrated.unavailable}`)
  } else {
    md.push(`ESLint plugins it left in the config (stripped here — native rules only): ${migrated.jsPlugins.length ? migrated.jsPlugins.map((p) => `\`${p}\``).join(', ') : 'none'}.`, '')
    md.push(`Rules in it that oxlint does not know (dropped so the run could proceed): ${migrated.pruned.length ? migrated.pruned.map((p) => `\`${p}\``).join(', ') : 'none'}.`, '')
    md.push('What the tool printed:', '', '```', migrated.said || '(nothing)', '```')
  }
  md.push('')

  md.push('#### D. The real tree, ESLint against oxlint', '')
  if (real.unavailable) {
    md.push(`Could not run: ${real.unavailable}`)
  } else {
    const es = real.es
    const files = new Set(real.directives.map((d) => d.file)).size
    md.push(`ESLint over the real tree (\`eslint .\`, comments in place): ${es.errors} errors, ${es.warnings} warnings, and ${es.unused} of its own "unused eslint-disable" warnings. Over a copy of the tree with every \`eslint-disable\` renamed (so ESLint has nothing to obey, and the React-compiler rules have no comment to skip a function over) it reports ${findings(es.suppressed)} — that is what the repo's ${real.directives.length} \`eslint-disable\` comments in ${files} files hold back, directly on the lines they cover and, for the React-compiler rules, by making the plugin skip the whole function around a \`react-hooks/…\` comment.`, '')
    if (es.byRule.size) {
      md.push(`ESLint's own findings by rule: ${[...es.byRule].map(([r, n]) => `\`${r}\` ${n}`).join(', ')}.`, '')
    }
    if (real.oxError) {
      md.push(`oxlint's side could not run: ${real.oxError}`)
    } else {
      md.push('**Each comment, checked against both tools.** A comment is *stale* when ESLint itself reports nothing on the line it covers (not oxlint\'s fault, and left out of the verdict). Otherwise the question is whether oxlint\'s rule of the same name fires on that line, with the comment neutralised. Where it fires on a different line of the file, the run with the comments in place decides: still reported in that file means the comment would have to move; quiet means it still silences the rule where it stands.', '')
      md.push('| rule named in the comments | comments | stale (ESLint finds nothing there) | oxlint fires on that line | on another line, comment still holds | on another line, comment would have to move | oxlint silent |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
      for (const [rule, t] of [...cmp.byRule].sort((a, b) => b[1].comments - a[1].comments)) {
        md.push(`| \`${cell(rule)}\` | ${t.comments} | ${t.stale} | ${t.fires} | ${t.held} | ${t.elsewhere} | ${t.silent} |`)
      }
      md.push('')
      md.push('**Findings per rule over the whole tree, on the renamed copy for both tools (ESLint with this repo\'s config, oxlint with the migrated one).**', '')
      md.push('| rule | ESLint | oxlint (migrated config) |', '| --- | ---: | ---: |')
      for (const r of cmp.perRule) md.push(`| \`${cell(r.rule)}\` | ${r.es} | ${r.ox} |`)
      md.push('')
      md.push(cmp.fewer.length ? 'Per file, where ESLint reports more than oxlint (comments neutralised):' : 'No file where ESLint reports more than oxlint (comments neutralised).')
      md.push(...listed(cmp.fewer))
      md.push('')
      md.push(`oxlint over the real tree with the comments in place reports ${findings(cmp.oxActiveTotal)}, of which ${cmp.extraTotal} ESLint does not report.`)
      md.push(...listed(cmp.extra))
    }
  }
  return { markdown: md.join('\n'), verdict, failed: invalid.length > 0 || incomplete }
}

try {
  const { markdown, failed } = report(measure())
  console.log(markdown)
  if (WRITE) {
    const text = readFileSync(RESULTS, 'utf8')
    const a = text.indexOf(BEGIN)
    const b = text.indexOf(END)
    if (a < 0 || b < a) fail(`${RESULTS} has no ${BEGIN} … ${END} block to write into`)
    writeFileSync(RESULTS, `${text.slice(0, a + BEGIN.length)}\n${markdown}\n${text.slice(b)}`)
    console.error(`wrote the tables into ${RESULTS}`)
  }
  if (failed) process.exitCode = 2
} catch (e) {
  console.error(e.message)
  process.exitCode = 2
}
