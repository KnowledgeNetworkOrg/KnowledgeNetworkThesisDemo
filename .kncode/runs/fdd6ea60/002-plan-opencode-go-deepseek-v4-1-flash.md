1. Add `REFUSAL_REASONS` and `DropVerdict.REASONS` to `src/ds/graph/DropVerdict.tsx`; default `DropRefusal` to `REFUSAL_REASONS.adjacent`.
2. Re-export `REFUSAL_REASONS` (and its reason-key type) from `src/ds/index.ts` so hosts read it through `@/ds`.
3. In `authordnd.ts`, make `refusedAt` return `{ ids, reason }` and `dropAllowed` return `'adjacent' | 'inside' | null`; return `'inside'` when the target gap is strictly beneath the dragged block's path.
4. Keep the existing adjacent rule intact: `handleDrop` refuses on any non-null result, so an inside-self drop runs no state op and adds no undo entry.
5. In `AuthorRoad.tsx`, carry `reason` in `Verdict`, derive `ok` from `dropAllowed === null`, pass `REFUSAL_REASONS[reason]` to `DropRefusal`, and use `refusedAt(...).ids` / `REFUSAL_REASONS.adjacent` for the picker instead of the local `ADJACENT` literal.
6. Remove the literal `'already adjacent'` from `NodePicker.tsx`'s comment so the required grep only finds the sentences in `DropVerdict.tsx`.
7. Update `authordnd.test.ts`, `DropVerdict.test.ts`, and `barrel.test.ts`; add regression cases for a group dragged into its own gap and for the unchanged adjacent case.
8. Run `npm run verify` and confirm the stated grep.

Files: `src/ds/graph/DropVerdict.tsx`, `src/ds/index.ts`, `src/state/walk/authordnd.ts`, `src/instruments/walkdesk/AuthorRoad.tsx`, `src/ds/graph/NodePicker.tsx` (comment only), `src/state/walk/authordnd.test.ts`, `src/ds/graph/DropVerdict.test.ts`, `src/ds/barrel.test.ts`

Out of scope: `design-system/components/graph/DropVerdict.jsx` and `design-system/components/graph/DropVerdict.d.ts` are the design system's own copies and must not be edited; the existing "same node twice in a row" refusal itself is unchanged.

Verify: In the walk editor, open a group and drag that group onto a gap between two of its own stops: the gap draws the struck `--verdict-no` line, the pill reads "inside itself", releasing changes nothing, and undo adds nothing; dragging beside a duplicate still reads "already adjacent". Then run:
```
npm run build
npm run test
npm run verify
```

Assumptions: "inside" means the target path is strictly deeper than the dragged block's own path (so dropping the group at its own position remains allowed); only `blk:` payloads carry a source path, so palette and `var:` drags cannot be "inside"; the picker can only show the adjacent sentence because it is filling its own slot; and the card's two named source files require the consumer, barrel, comment, and test edits above to satisfy its done-when.