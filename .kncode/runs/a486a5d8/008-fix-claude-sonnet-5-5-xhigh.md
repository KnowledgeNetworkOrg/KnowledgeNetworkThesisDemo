1. R0-1 (nit): fixed. `CLAUDE.md:42` now says "will crash the *other* corpus on import". It is a wording change only.
2. The person's answer ("Let's edit") asked for nothing beyond the finding above, so nothing further was done.

I re-ran the card's done-when grep once after the edit. It prints nothing (exit 1, no matches). I did not run `npm run verify` or the browser drivers, because the change is one word in a Markdown file.

Assumptions: `CLAUDE.md` is a locked file. I edited it because the card names it and this is a one-word correction to the paragraph under the section the card retitles. The tool will hold it for the owner's Allow or Drop along with the card's own `CLAUDE.md` edit.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"CLAUDE.md:42 now reads \u0022will crash the *other* corpus on import\u0022. Wording only; the done-when grep still prints nothing.","duplicateOf":null}]}
-->
