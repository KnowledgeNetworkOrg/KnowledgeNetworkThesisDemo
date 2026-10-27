1. R0-1: fixed — added tests for verbatim `legacy` (non-object entries included), a non-object v1 payload reading as corrupt, and the prepared copy skipping non-string/empty values (`src/present/lecturenotes.test.ts`).
2. R0-2: fixed — the bare-flag test now saves and reloads through storage before resolving and checking `flaggedStops` (`src/present/lecturenotes.test.ts:43`).

Nits R0-3, R0-4 and R0-5 left alone, as permitted.

Assumptions: the prepared-copy test checks only the card's wording (non-string, empty string, `null`), not whitespace-only values.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"Added three tests in \u0060src/present/lecturenotes.test.ts\u0060 before the existing v1 move test: a v1 \u0060notes\u0060 array containing a string and \u0060null\u0060 is kept verbatim in \u0060legacy\u0060 (in memory and in the written v2 envelope); a v1 payload whose \u0060data\u0060 is a string reads as corrupt and its bytes stay on disk; and the once-only prepared copy keeps a string but skips a number, an empty string and \u0060null\u0060.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"Replaced the in-memory-only bare-flag test with a chain at \u0060src/present/lecturenotes.test.ts:43\u0060 that adds a bare flag, saves and reloads it through \u0060saveNotebook\u0060/\u0060loadNotebook\u0060, checks \u0060text: \u0027\u0027\u0060, \u0060stopId\u0060 and \u0060lectureId\u0060, sees its stop in \u0060flaggedStops\u0060, then resolves it, checks the entry and \u0060resolvedAt\u0060 are kept, and sees the stop gone from \u0060flaggedStops\u0060.","duplicateOf":null}]}
-->
