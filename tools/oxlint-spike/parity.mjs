// parity.mjs — can oxlint replace ESLint in this repo without anything going dark? (#65)
//
// WHY THIS EXISTS. The card asks for a decision on evidence, and the evidence has to be
// something anyone can reproduce, not a reading of two rule lists. Linting a tree that
// already passes `eslint .` proves almost nothing — both tools report "clean" — so the
// real test is to PLANT one violation per rule family this repo relies on and see which
// tool says so. Three measurements, all of them native-only (see below):
//
//   A. PLANTED VIOLATIONS. One tiny file per family, written to a scratch folder in the
//      OS temp directory — never into the repo, so `npm run lint` can never see them.
//      ESLint runs over it with THIS repo's `eslint.config.js` (so the scoped bans land
//      on the paths they are scoped to); oxlint runs with every category and plugin on,
//      the most generous setting there is. An ESLint cell that says "silent" means the
//      planted code is wrong, not that ESLint is — the verdict is then TEST INVALID.
//   B. RULE INVENTORY. Every rule `eslint --print-config` says is active for a src .tsx
//      file, checked by name against `oxlint --rules`. Names only: a same-named rule can
//      still behave differently, which is exactly why A exists.
//   C. DISABLE COMMENTS. The repo carries `eslint-disable` comments, each sitting on a
//      line where an ESLint rule really fires. oxlint is run over the real tree with
//      unused-directive reporting on; a directive it calls unused is a rule that is not
//      firing there for oxlint.
//
// NATIVE RULES ONLY. oxlint can also be pointed at ESLint plugins and run them, but that
// keeps the ESLint packages installed, and the card's step 3 is to drop them. A rule that
// only fires through an ESLint plugin is not parity.
//
// oxlint is installed into a temp folder and never added to package.json.
//
// Run:  node tools/oxlint-spike/parity.mjs           — print the tables
//       node tools/oxlint-spike/parity.mjs --write   — also write them into RESULTS.md
//       node tools/oxlint-spike/parity.mjs --keep    — leave the temp folder for inspection
// Env:  OXLINT_VERSION=1.2.3  pins the version (default: latest; the run records which)
//       OXLINT_BIN=<path>     uses an oxlint launcher already on disk instead of installing
// Needs `npm ci` first, for the repo's own ESLint. Exit 2 means the harness could not
// measure (or the test is invalid); 0 means it measured, whatever the verdict is.
import {
  closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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

const fail = (message) => { throw new Error(message) }
const rel = (f) => f.replace(/\\/g, '/')
const cell = (s) => String(s).replace(/\|/g, '\\|')
const tail = (r) => ((r.stderr || r.stdout || '').trim().split('\n').slice(-8).join('\n'))

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
export function Mirror({ value }: { value: number }) {
  const [copy, setCopy] = useState(0)
  useEffect(() => {
    setCopy(value)
  }, [value])
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
    what: 'a value from `useState` mutated in place during render',
    file: 'src/plant-immutability.tsx',
    code: `import { useState } from 'react'
export function Mutate() {
  const [items] = useState<number[]>([])
  items.push(1)
  return <span>{items.length}</span>
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

const installOxlint = (root) => {
  if (process.env.OXLINT_BIN) return resolve(process.env.OXLINT_BIN)
  const dir = join(root, 'oxlint')
  mkdirSync(dir)
  writeFileSync(join(dir, 'package.json'), '{"private":true}\n')
  const r = spawnSync(`npm install oxlint@${VERSION} --no-audit --no-fund --loglevel=error`, {
    cwd: dir, shell: true, encoding: 'utf8',
  })
  if (r.status !== 0) fail(`could not install oxlint@${VERSION}:\n${tail(r)}`)
  const pkgDir = join(dir, 'node_modules', 'oxlint')
  const { bin } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  return join(pkgDir, typeof bin === 'string' ? bin : bin.oxlint)
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

const severity = (v) => {
  const s = Array.isArray(v) ? v[0] : v
  return s === 'error' ? 2 : s === 'warn' ? 1 : s === 'off' ? 0 : Number(s)
}

const walk = (dir, visit) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.venv', 'dist', '.git'].includes(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, visit)
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) visit(p)
  }
}

// ---- the run ------------------------------------------------------------------------
const measure = () => {
  if (!existsSync(eslintBin)) fail('eslint is not installed here — run `npm ci` first')
  if (!/^[\w.-]+$/.test(VERSION)) fail(`OXLINT_VERSION must look like 1.2.3 or latest, not "${VERSION}"`)

  const root = mkdtempSync(join(tmpdir(), 'oxlint-parity-'))
  try {
    const scratch = join(root, 'scratch')
    mkdirSync(join(scratch, 'src'), { recursive: true })
    for (const f of FAMILIES) writeFileSync(join(scratch, f.file), f.code)
    const cfg = join(root, 'oxlintrc.json')
    writeFileSync(cfg, `${JSON.stringify(OXLINT_CONFIG, null, 2)}\n`)

    const launcher = installOxlint(root)
    const oxlint = (a, cwd) => {
      const [cmd, pre] = isNodeScript(launcher) ? [process.execPath, [launcher]] : [launcher, []]
      return spawnSync(cmd, [...pre, ...a], { cwd, encoding: 'utf8', maxBuffer: 1 << 29 })
    }
    // `-c` makes ESLint take its base path from the cwd, so the scratch files sit at
    // `src/...` exactly where the config's globs are written for the repo.
    const eslint = (a) =>
      spawnSync(process.execPath, [eslintBin, '-c', join(REPO, 'eslint.config.js'), ...a], {
        cwd: scratch, encoding: 'utf8', maxBuffer: 1 << 28,
      })

    const versions = {
      node: process.version,
      eslint: JSON.parse(readFileSync(join(REPO, 'node_modules', 'eslint', 'package.json'), 'utf8')).version,
      oxlint: (oxlint(['--version'], scratch).stdout || '').replace(/^\s*(oxlint\s+)?version:?\s*/i, '').trim(),
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

    // B. rule inventory
    let inventory = null
    const pc = eslint(['--print-config', 'src/plant-exhaustive-deps.tsx'])
    const rl = oxlint(['--rules', '-c', cfg], scratch)
    const oxRules = new Map()
    for (const line of (rl.stdout || '').split('\n')) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
      if (cells.length < 2 || /^[-: ]+$/.test(cells[0]) || /^rule name$/i.test(cells[0])) continue
      const name = cells[0].replace(/^\[([^\]]+)\]\([^)]*\)$/, '$1')
      oxRules.set(name, [...(oxRules.get(name) ?? []), cells[1]])
    }
    if (pc.status === 0 && oxRules.size > 0) {
      const active = Object.entries(JSON.parse(pc.stdout).rules ?? {})
        .filter(([, v]) => severity(v) > 0)
        .map(([n]) => n)
      const short = (n) => n.slice(n.lastIndexOf('/') + 1)
      inventory = {
        total: active.length,
        oxTotal: oxRules.size,
        missing: active.filter((n) => !oxRules.has(short(n))),
      }
    } else {
      inventory = { unavailable: `eslint --print-config exit ${pc.status}; oxlint --rules listed ${oxRules.size} rules (exit ${rl.status})\n${tail(rl)}` }
    }

    // C. disable comments, over the real tree
    const directives = new Map()
    for (const top of ['src', 'tools', 'desktop']) {
      if (!existsSync(join(REPO, top))) continue
      walk(join(REPO, top), (file) => {
        for (const line of readFileSync(file, 'utf8').split('\n')) {
          const m = /eslint-disable(?:-next-line|-line)?\s+([\w@/-]+)/.exec(line)
          if (m) directives.set(m[1], (directives.get(m[1]) ?? 0) + 1)
        }
      })
    }
    let disables = null
    const rr = oxlint([
      '-c', cfg, '--format', 'json', '--report-unused-disable-directives',
      '--ignore-pattern', '**/.venv/**', '--ignore-pattern', 'dist', 'src', 'tools', 'desktop',
    ], REPO)
    try {
      const diags = diagnosticsOf(rr, 'the real tree')
      const unusedBy = new Map()
      for (const d of diags) {
        const text = `${d.code ?? ''} ${d.message ?? ''}`
        if (!/unused/i.test(text) || !/disable|directive/i.test(text)) continue
        const lineNo = d.labels?.[0]?.span?.line
        let rule = '(rule not read)'
        try {
          const src = readFileSync(resolve(REPO, d.filename), 'utf8').split('\n')[lineNo - 1] ?? ''
          rule = /eslint-disable(?:-next-line|-line)?\s+([\w@/-]+)/.exec(src)?.[1] ?? rule
        } catch { /* leave it unread */ }
        unusedBy.set(rule, (unusedBy.get(rule) ?? 0) + 1)
      }
      disables = { unusedBy }
    } catch (e) {
      disables = { unavailable: e.message }
    }

    return { versions, rows, inventory, directives, disables }
  } finally {
    if (KEEP) console.error(`kept ${root}`)
    else rmSync(root, { recursive: true, force: true })
  }
}

// ---- the report ---------------------------------------------------------------------
const report = ({ versions, rows, inventory, directives, disables }) => {
  const invalid = rows.filter((r) => !r.eslintHit)
  const silent = rows.filter((r) => !r.oxHit)
  const missing = inventory.missing ?? []
  const unusedTotal = disables.unusedBy ? [...disables.unusedBy.values()].reduce((a, b) => a + b, 0) : null
  const incomplete = !!inventory.unavailable || !!disables.unavailable

  let verdict
  if (invalid.length) {
    verdict = `TEST INVALID — ESLint did not report the planted violation for: ${invalid.map((r) => r.key).join(', ')}. The planted code or the harness is wrong, not oxlint.`
  } else if (silent.length || missing.length || unusedTotal > 0) {
    const bits = []
    if (silent.length) bits.push(`${silent.length} of ${rows.length} planted violations oxlint does not report (${silent.map((r) => r.key).join(', ')})`)
    if (missing.length) bits.push(`${missing.length} active ESLint rules with no same-named oxlint rule`)
    if (unusedTotal > 0) bits.push(`${unusedTotal} of ${[...directives.values()].reduce((a, b) => a + b, 0)} disable comments oxlint calls unused`)
    verdict = `KEEP ESLINT — ${bits.join('; ')}.`
  } else if (incomplete) {
    verdict = 'INCONCLUSIVE — every planted violation fires in both tools, but the inventory or the disable-comment check could not run (see below).'
  } else {
    verdict = `PARITY HOLDS — all ${rows.length} planted violations fire in both tools, every active ESLint rule has a same-named oxlint rule, and no disable comment is reported unused.`
  }

  const md = []
  md.push(`**Verdict: ${verdict}**`, '')
  md.push(`Measured ${new Date().toISOString().slice(0, 10)} with oxlint ${versions.oxlint || 'unknown'}, eslint ${versions.eslint}, node ${versions.node}.`, '')

  md.push('#### A. One planted violation per rule family', '')
  md.push('| family | what is planted | ESLint (this repo\'s config) | oxlint (native rules, everything on) |', '| --- | --- | --- | --- |')
  for (const r of rows) md.push(`| ${cell(r.key)} | ${cell(r.what)} | ${cell(r.eslintCell)} | ${cell(r.oxCell)} |`)
  md.push('')

  md.push('#### B. Active ESLint rules that oxlint has no same-named rule for', '')
  if (inventory.unavailable) {
    md.push(`Could not run: ${inventory.unavailable}`)
  } else {
    md.push(`ESLint has ${inventory.total} rules active for a \`src\` .tsx file; oxlint lists ${inventory.oxTotal} rules. ${missing.length ? 'Without a same-named oxlint rule:' : 'Every active ESLint rule has a same-named oxlint rule.'}`, '')
    for (const n of missing) md.push(`- \`${n}\``)
  }
  md.push('')

  md.push('#### C. `eslint-disable` comments in the real tree, run through oxlint', '')
  if (disables.unavailable) {
    md.push(`Could not run: ${disables.unavailable}`)
  } else {
    md.push('| rule named in the comment | comments in the tree | oxlint reports unused |', '| --- | ---: | ---: |')
    for (const [rule, n] of [...directives].sort((a, b) => b[1] - a[1])) {
      md.push(`| \`${cell(rule)}\` | ${n} | ${disables.unusedBy.get(rule) ?? 0} |`)
    }
    const other = [...disables.unusedBy].filter(([rule]) => !directives.has(rule))
    for (const [rule, n] of other) md.push(`| \`${cell(rule)}\` (not matched above) | — | ${n} |`)
  }
  return { markdown: md.join('\n'), verdict, invalid: invalid.length > 0 }
}

try {
  const { markdown, invalid } = report(measure())
  console.log(markdown)
  if (WRITE) {
    const text = readFileSync(RESULTS, 'utf8')
    const a = text.indexOf(BEGIN)
    const b = text.indexOf(END)
    if (a < 0 || b < a) fail(`${RESULTS} has no ${BEGIN} … ${END} block to write into`)
    writeFileSync(RESULTS, `${text.slice(0, a + BEGIN.length)}\n${markdown}\n${text.slice(b)}`)
    console.error(`wrote the tables into ${RESULTS}`)
  }
  if (invalid) process.exitCode = 2
} catch (e) {
  console.error(e.message)
  process.exitCode = 2
}
