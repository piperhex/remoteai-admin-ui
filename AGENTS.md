# Agent Notes

- Keep these instructions in English. This is the independent Remote AI admin interface.
- Install and verify here with `npm ci` and `npm run check`; build output belongs in `dist/`.
- Do not import parent or sibling source paths or add this project to the parent's npm workspaces.
- Shared components and all translatable copy come from the public `@remoteai/shared` and `@remoteai/i18n`
  package interfaces. Shared-component archives in `vendor/` are generated dependencies. Language resources
  come directly from an immutable `piperhex/remoteai-i18n` release and must not be copied into `vendor/`.
  Update shared sources in `piperhex/remoteai` and translations in `piperhex/remoteai-i18n`; review provenance,
  release versions and lockfiles. Run `npm run check:i18n` after dependency or application copy changes.
- Preserve existing language availability, fallback behavior, appearance and application typography.
- UI changes require inspected screenshots from the running application. Browser tests on Windows must
  use bundled Playwright Chromium and preserve the password-probe protections from the parent's
  [browser test helper](https://github.com/piperhex/remoteai/blob/master/scripts/test-browser.mjs).
- Context menus must support both right-click and touch long-press.
- Keep modules focused, avoid unrelated refactoring, and verify relevant tests and production builds.
- Commit and push verified task changes before the parent repository updates this submodule's gitlink.
