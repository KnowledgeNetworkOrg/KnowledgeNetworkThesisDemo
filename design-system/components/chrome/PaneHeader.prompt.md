One-line: the standard pane hat — the title sits on the pane's own border, like a legend.

```jsx
// Reach for `Pane`. It renders this header AND the box its geometry depends on.
<Pane title="tree" onClose={drop}>
  …
</Pane>

// By hand, only where something genuinely cannot use `Pane` — then all three rules below
// are yours to keep, and the app got two of them wrong from a snippet exactly like this:
<section style={{ position: 'relative', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-paper)', overflow: 'visible' }}>
  <PaneHeader title="tree" onClose={drop} />
  <PaneScroller>…</PaneScroller>   {/* never a raw overflow:auto, never a clip around it */}
</section>
```

**The hand-composed form was the ONLY form this snippet showed until 2026-08-21**, which is
half of why `src/studio/StudioView.tsx` builds its own frame around every instrument: the
first thing a reader met here was a `<section>` to copy. `Pane` has existed since
2026-08-17 and makes all three rules unstateable-wrong. Lead with it.

The pane must be `position: relative` and carry the border itself, and its corner radius must be `--radius-lg` (20px) — the header masks the border with a straight 2px bar, which cannot erase a curve, so the `✕` notch is inset to stop exactly where the corner arc begins. A tighter radius leaves a stub of border beside the button. **That inset is also the hard limit on the ✕'s position**: the button is pushed as far right as it goes by unbalancing its own padding (`0 1px 0 5px`), and the notch's left edge moves with it (`left: 4`) so the gap in the frame stays even on both sides of the button instead of trailing off to its left. Do not move it further right — the notch would reach into the arc. `legendBg` must match what is BEHIND the pane (default `--surface-canopy`) — that is what masks the border under the title. Use `variant="bar"` only where a pane sits flush against another surface and there is no border to interrupt.

**The pane's body is the header's business too**, because this header is only 11px tall and the pane's corner arc is 20px. **Prefer `Pane`**, which owns the frame and the body and makes the three rules below unstateable-wrong; what follows applies when something composes a frame by hand. **The body takes no background of its own** — the pane's `--surface-paper` shows through it. A body that paints its own colour starts inside the arc with square corners and bites two square notches out of the pane's rounded top; painted `--surface-canopy` it reads as a hole in the sheet rather than as a pane. **Fix that by deleting the background, never by clipping** — the four-corner clause is an escape hatch for a pane whose CONTENT must be cropped, and `StudioView.tsx:216` took it as an instruction: an `overflow: hidden` + `--radius-lg` div inside the frame, over bodies that still paint `bg-slate-50`, which hides the notches and in exchange bites the scroller's gutter with the arc and traps the body's menus. And **a scrolling body insets itself 12px from the top AND the bottom** (`marginTop` and `marginBottom`, not a radius on the scroller), so the scrollbar's end arrow stays clear of the corner at either end instead of being clipped by it or painting out over it; the pane's own paper fills both strips, and one inset serves both axes and both ends. **That last rule said "from the bottom" here until 2026-08-21** — the 2026-08-17f amendment reached `Pane.jsx` and not this file, so a port built the bottom-only form faithfully (`PaneHeader.tsx:37`, `StudioView.tsx:219`'s `mb-3`) and the palette's top arrow still crosses its corner. All three of these were readme-only rules until 2026-08-17, and all three were missed in the app — the road pane paints its body canopy and its scroller runs to the corner. A rule that only exists in prose does not reach a port; it belongs here.

**A floating pane passes `grabbable`; it does not rewrite the hat.** The header then owns the whole affordance — `cursor: grab` → `grabbing`, `touch-action: none`, `user-select: none`, and the grabbing state cleared on the *window* — and calls `onGrabStart` on pointerdown. It does not move anything, capture the pointer, or listen for move/up: where the pane ends up is the host's, since only the host knows its coordinate space, its bounds and its z-order. Authoring it self-positioning would repeat `VersionedGroup`'s mistake. Default is `false`, because a docked pane must not offer a grab cursor. Added 2026-08-18, answering the question in `receipts/c9b2ced.md`: the app's `FloatingPanel` hand-wrote this entire legend for want of this one prop, kept its drag, and drifted the notch padding to `0 8px` while it was there — structurally identical in every other respect, which is how copies drift. The owner's call, and the better one: the header owns the affordance rather than handing back a `titleProps` spread a caller can fill wrongly.

**A `grabbable` header marks its title `data-grab=""`** — the same attribute `VersionedGroup` puts on its card's grab surface, so `[data-grab]` finds every drag handle in the system. Tests and interaction drivers use that, never the title's text, which changes whenever the copy does. It hands over an identifier and nothing else: no cursor, `touch-action` or selection behaviour comes with it, which is precisely why it is not the `titleProps` spread that was refused. Added 2026-08-19 — adopting this hat cost the app's panel driver its own `aria-label` hook and it fell back to matching text.

**`legendBg` is what sits BEHIND the pane, and its default is the desk.** A pane floating above anything else must pass its own face (`--surface-raised` for a floating panel), or the mask paints a canopy-coloured notch across the pane's own top border. It fails as a colour rather than as an error, so nothing reports it; the app's `FloatingPanel` hit exactly this on adoption.

Titles are lower case and that is **all** a pane header holds — no subtitle, no explanatory line. If a pane needs to explain itself, it does so in its body. Put icon-height pane controls in `actions`; `onClose` renders the `✕` (an 18px box, 10px glyph, tooltip “close”), which hovers like every other icon button. **The ✕ keeps the scrollbar's manners**: absent while the pane is at rest, fading in when the pointer or the keyboard is inside the pane, and receding on the scrollbar's own grace period (`window.PKT_SB.LEAVE`, 500ms) so the control and the bar leave together. Its notch in the frame fades with it — a dormant pane wears an unbroken border, never a gap where a control used to be. The pane element itself is what the header listens to, so `onClose` requires the wrapping `<section>` shown above. A pane is either in the composition or dropped from it — there is no minimized state.

**Weight against the app bar.** The legend is `--fs-title` / `--fw-semibold`; `AppHeader`'s product name is the same size at `--fw-bold`. Order is app name → pane legend → pane section head (`SectionLabel`, `--fs-caption` bold) → sub-head (`--text-2` semibold). The one thing allowed to out-shout a pane legend is `DocHeader`'s node title (`--fs-head`, in the domain hue) — it is the subject the whole workspace is focused on, not chrome.

---

**Replaces in the app:** the per-pane title row in `src/studio/StudioView.tsx`, and — as of
the `grabbable` prop — the hand-written legend in `src/ui/FloatingPanel.tsx` (its own notch,
mask and title, kept because its title doubles as the drag handle).
**Adopted** in `StudioView.tsx`; the legend padding drifted there to `0 8px` against this
project's `0 5px` and was corrected in `c9b2ced`. **`FloatingPanel` adopted it in `ac952cd`** —
header only, not `Pane`, deliberately: `Pane` is paper at `--radius-lg` with `--border-frame`
and would have restyled a floating overlay into a docked one. Its hand-written notch, mask,
title span and `0 5px` literal are deleted. OB-013 cleared.

**Hosted by:** `Pane`, which hands it the frame through `PaneFrameContext` (declared in THIS file and imported by `Pane`; the reverse direction is a cycle) — so it knows
which element to watch for the pointer, and can sit at any depth inside the pane. Until
2026-08-17e it reached `parentElement`, and "must be a direct child" was a rule a wrapper
div could break in silence: the ✕ simply never appeared and nothing said why. That walk is
still the fallback for a pane composed BY HAND without `Pane`, where the header does have
to be a direct child. Reach for `Pane` rather than this either way: the pane's three
geometric rules are the frame's, not the hat's.

- **`tally` (2026-09-27):** the count on the frame's border at the right end, before `actions` and the ✕. Forwarded by `Pane`; see `Pane.prompt.md`.
