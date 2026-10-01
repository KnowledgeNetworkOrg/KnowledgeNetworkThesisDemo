PASS

Commands run:
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser

`npm run verify` is the project's own full check: build, desktop typecheck, lint, and unit tests. It passed, with all 61 test files and 845 unit tests green. `npm run test:browser` drives the app in Microsoft Edge, including the pin-reading drivers the card names, and passed 33 of 33 with no flaky retries. I changed no code.