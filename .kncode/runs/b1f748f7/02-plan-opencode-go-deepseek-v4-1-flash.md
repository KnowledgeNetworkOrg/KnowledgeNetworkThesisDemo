I have enough context. The window (`#202`) already runs and serves the built `dist/` over `app://`; this slice adds `electron-builder` config to turn that same build into a portable `.exe`.

1. Add `electron-builder` to `desktop/package.json` devDependencies and a `pack` script that runs the whole chain in one command.
2. Add `desktop/pack.mjs` (mirroring `start.mjs`) that runs root `npm run build`, then `node build.mjs`, then `electron-builder --win portable`.
3. Add `desktop/electron-builder.yml`: `files: out/**/*`; `extraResources` copying root `../dist` to `resources/dist` (keeps it a real file path outside asar, so `net.fetch(file://)` keeps working); target `portable`, x64, unsigned; output dir `desktop/release`.
4. Change `desktop/main.ts` `DIST` to use `join(process.resourcesPath, 'dist')` when `app.isPackaged`, else the existing repo path (the `#203` note on line 38 anticipates exactly this).
5. Add `release` to `desktop/.gitignore`.
6. Document in `README.md`: one-command build, output path, and the unsigned-first-run SmartScreen warning.

Files: `desktop/package.json`, `desktop/pack.mjs` (new), `desktop/electron-builder.yml` (new), `desktop/main.ts`, `desktop/.gitignore`, `README.md`

Out of scope: an NSIS installer (portable only), code signing/certificate, any CI packaging job (`code-verify.yml` stays Electron-free), macOS/Linux targets, auto-update, and a real `.ico` (placeholder only; a design task later).

Verify: run the build, copy `desktop/release/*-portable.exe` to a machine/folder with no repo and no Node, double-click it, and confirm the Graph Disclosure Lab window opens with content and shows the SmartScreen warning the README documents.

```
npm ci --prefix desktop
npm run build
npm --prefix desktop run pack
```

Assumptions:
- Placeholder icon means no new asset: omit `win.icon` so electron-builder falls back to Electron's default icon; swapping in a real `.ico` later is config-only.
- `dist` is shipped via `extraResources` (outside asar) rather than inside it, because the loader uses `net.fetch(file://)`.
- Windows x64 only; a recent electron-builder major compatible with Electron 44, pinned at implementation time.
- Output goes to `desktop/release/`, kept out of git.