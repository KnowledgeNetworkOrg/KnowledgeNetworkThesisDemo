PASS

Nothing failed.

Commands I ran:
```
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser -- mapconnections --workers=1
npm run test:browser -- explorerrail --workers=1
npm run test:browser
```

**What passed.** `npm run verify` builds the app, typechecks the desktop part, lints and runs the unit tests. It passed: 54 test files and 664 tests. The three browser runs also passed. Those are real Edge browser sessions on the built app.

- **The check for this change:** the map connections browser test, which now includes the new overlap check, passed. That covers both halves of the fix. With the rail closed, every domain name is still drawn. With the rail open, no two drawn names overlap.
- **The rail test:** the Explorer rail test passed. It still expects the rail to start closed, which matches the current setting.
- **The whole browser suite:** all 32 tests passed. They exercise the map heavily, so this shows the change didn't break anything nearby.

This settles the first caveat from the review, that nothing had been run. The `sys`/`cs` collision was not reproduced before the change, because that step doesn't fit this task. The passing overlap check is the evidence that the collision is gone.

The other review items are untouched: the test title that says "BOTH axes" when it means "EITHER", the lost fade on a dropped name, and whether the rail should open by default. None of them affects a build or test result, and fixing them would be new work.