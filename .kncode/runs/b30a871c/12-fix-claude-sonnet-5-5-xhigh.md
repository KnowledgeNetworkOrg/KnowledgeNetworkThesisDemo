1. **Must fix 1 (the new test breaks the type-check, so the build fails):** fixed. I made three edits:
   - **Test file:** the test no longer imports the three source files as raw text. It now reads them with plain file reads, and a comment says why.
   - **App settings:** the test is now on the exclude list in `tsconfig.app.json`, so the browser-only type-check no longer sees it.
   - **Node settings:** the test is now on the include list in `tsconfig.node.json`. That's the same arrangement the six existing file-reading tests already use.

   The test's assertions are unchanged.

I couldn't run the real test runner or the type-check, because this checkout has no packages installed. I replayed the six text checks the test makes (breadcrumb, palette presets block, document button) with plain Node against the real files, using the same file paths the test now reads. All six held. I also confirmed the test is named once in each settings file. The full build and test run is left to the check step.

Assumptions: the reviewer's in-memory type-check, which found that this exact variant compiles under both settings files, is accurate. I couldn't reproduce it here without packages. I left the Optional items alone.