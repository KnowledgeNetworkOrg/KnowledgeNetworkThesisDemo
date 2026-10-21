Implemented the “inside itself” refusal:

- Added `REFUSAL_REASONS`, `RefusalReason`, the `DropRefusal` default, and `DropVerdict.REASONS` in `src/ds/graph/DropVerdict.tsx`, re-exported through `@/ds`.
- Changed `refusedAt` to return `{ ids, reason }` and `dropAllowed` to return `'adjacent' | 'inside' | null`; a target strictly beneath the dragged block’s path is now refused as `inside`.
- Updated `AuthorRoad` to carry the reason, draw the struck line, show the matching pill sentence, and use the barrel constants; updated the picker’s comment and tests, including regression cases for a group over its own gap and the unchanged adjacent case.
- Removed the `'already adjacent'` literal from `AuthorRoad` and the picker comment, so the required grep finds both sentences only in `DropVerdict.tsx`.
- Targeted tests and `tsc -b` pass. `npm ci` was run because `node_modules` was absent.

Assumptions: “inside” means the target path is strictly deeper than the dragged block’s own path, so dropping the group back at its own position remains allowed; only `blk:` payloads can be “inside”; the picker only ever shows the adjacent sentence because it fills its own slot; and the design-system copies were left untouched.