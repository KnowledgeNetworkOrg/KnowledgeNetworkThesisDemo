PASS

Commands I ran:
```
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser -- firstline --workers=1
npm run test:browser -- explorerrail --workers=1
npm run test:browser -- relationsrail --workers=1
npm run test:browser -- legendinset --workers=1
node tools/studio-spike/browsertest-explorerrail.mjs
npm run test:browser -- explorerrail --workers=1
npm run test:browser
```

**What this means:**
- **Full check:** `npm run verify` passed. That covers the build, the typecheck of the `desktop/` part, lint, and 856 unit tests in 62 files. This includes the new test that makes sure no file restates the shared numbers 25, 14 and 2.
- **New browser test:** the new first-line test (`browsertest-firstline.mjs`) passed. It measures the panes' first lines in a real Edge browser, so the "25 ±1" reading and the Relations rail being open at 1750px wide held up. The legend-inset test and the relations-rail test also passed.
- **Whole suite:** all 34 browser tests passed, one of them only on its automatic retry.
- **Flaky starts:** two tests failed once at startup. Each died after about one second, which is where a test waits for its dev server to come up. The first was the Explorer-rail test, which failed twice in a row in my first loop, then passed on three later runs. The second was the relations-rail test during the full suite, which passed on retry. No other test uses either port, so I think the cause is the machine, not the change, but I did not find the exact cause.
- **Not done:** I did not touch the two small bookkeeping items from the review (the provenance note wording and the barrel ledger entry), and the receipt to the design side is still to be filed.