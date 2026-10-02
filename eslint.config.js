import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// #211 — THE HOST-SHAPE BAN. `src/platform/types.ts` documents `platform.name`
// as "a readout for humans and for drivers — never a thing to branch on", and
// this is the machine half of that sentence. The seam asks what CAN BE DONE
// here; branching on WHAT IS RUNNING this throws away capability in both
// directions — `platform.name === 'electron'` would have killed #204's
// choose-a-display feature in every browser (Chromium answers it with
// `getScreenDetails()`), and it is the one line that makes the later web port
// impossible. A capability the seam cannot yet answer needs a new METHOD with an
// honest weak answer, not a host test at the call site.
//
// Shared rather than repeated because flat config REPLACES `no-restricted-syntax`
// wholesale when a later block re-declares it: the #61 ratchet below covers three
// files that are also under `src/**`, so it has to carry this entry itself or
// those three would silently lose the ban.
const noHostBranch = {
  selector: [
    "BinaryExpression[operator=/^[!=]==?$/] > MemberExpression[object.name='platform'][property.name='name']",
    "SwitchStatement > MemberExpression[object.name='platform'][property.name='name']",
  ].join(', '),
  message:
    "host-shaped branch — `platform.name` is a readout, not a decision. Ask the seam what it CAN DO (add a capability method whose weak answer is [] or false) rather than what is running us (#211).",
}

export default defineConfig([
  // the evoc spike carries a Python venv; eslint was walking into its vendored
  // matplotlib JS and reporting on it. Noise in every `npm run verify`.
  // desktop/release is `npm --prefix desktop run pack`'s output (#203): it holds a
  // second, minified copy of dist/ that lint would otherwise read after a pack.
  globalIgnores(['dist', 'desktop/release', '**/.venv/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },

  // DS ports mirror the Design System's own module shape, and several DS
  // components ship a colocated style helper beside the component — caretStyle in
  // TreeRow, bulletStyle in InstrumentRow, FamilyColumn in InstrumentGroup — that
  // a sibling imports by name (InstrumentGroup pulls caretStyle from TreeRow so
  // the palette and the tree draw nesting one way). react-refresh/only-export-
  // components would force us to split those helpers into separate files and
  // diverge from the DS structure for a dev-only HMR nicety. Relax it for the DS
  // ports, the same way #61's raw-value bans are deliberately absent here.
  {
    files: ['src/ds/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Spike harness entry points (tools/*-spike/**) mount a throwaway page for one
  // driver to photograph, so the components they declare live in the entry file
  // by design — there is nothing to import them. react-refresh's rule is about
  // HMR in the app; these pages are screenshotted and thrown away.
  {
    files: ['tools/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', noHostBranch] },
  },

  // #61 — DS-adherence ratchet. The Design System is the source of truth for
  // style; app code consumes its tokens as var(--…), never raw values. These
  // bans are the machine enforcement of that rule, authored as native ESLint
  // rather than by adopting oxlint (every rule here is stock esquery; #65 asked
  // whether oxlint could replace ESLint outright, and the answer was no —
  // tools/oxlint-spike/parity.mjs is the re-runnable check, and
  // tools/oxlint-spike/RESULTS.md holds what it last measured). The DS's
  // `_adherence` config is the reference SPEC; it is not vendored or run here.
  //
  // It is NOT repo-wide: ~84 raw hex + ~216 px still live in the un-migrated
  // alt-visualizations (#69) and the walkdesk, so a global `eslint .` ban can't
  // pass yet. Instead the ban is SCOPED to files already token-clean and grows
  // one entry at a time as each surface is migrated. `src/ds/**` primitives are
  // deliberately absent — design values legitimately live in the DS ports.
  {
    files: ['src/App.tsx', 'src/studio/StudioView.tsx', 'src/studio/AppToolbar.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        // re-declared here, not inherited — see noHostBranch's note above.
        noHostBranch,
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'raw hex colour — consume a DS --color token via var(--…), not a literal (#61 adherence).',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'raw hex colour in a template — consume a DS --color token via var(--…) (#61 adherence).',
        },
        {
          // catches a hard-coded `10px`, but NOT a computed `${n}px` (its static
          // chunk is just "px" — no digit — so a legitimate arithmetic width passes)
          selector: 'Literal[value=/\\b\\d+px\\b/]',
          message: 'raw px — use a DS spacing/size token or the Tailwind scale, not a px literal (#61 adherence).',
        },
        {
          selector: 'TemplateElement[value.raw=/\\b\\d+px\\b/]',
          message: 'raw px in a template — use a DS spacing/size token or the Tailwind scale (#61 adherence).',
        },
      ],
    },
  },
])
