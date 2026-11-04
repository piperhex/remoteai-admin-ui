# Remote AI Admin UI

Independent management interface for [Remote AI Admin](https://github.com/piperhex/remoteai-admin).

```sh
npm ci
npm run check
npm run dev
```

Open `http://127.0.0.1:1421/admin.html`. The development proxy expects the Go backend on port 8080.
`npm run build` writes only to this repository's `dist/` directory. The backend's Docker build takes this
repository as the named `admin-ui` build context and packages the resulting static assets.

Shared components and translations are immutable npm archives in `vendor/`. Their editable sources remain
in `piperhex/remoteai` under `shared/` and `packages/i18n/`; `vendor/source-lock.json` records the source
revision and SHA-256 hashes. This preserves one translation source and allows offline runtime behavior.
To refresh them, run `npm run export:admin-ui -- /path/to/remoteai-admin-ui` from the parent checkout,
then run `npm install`, `npm run check`, and review the archive and lockfile changes here.

Chinese and English remain complete; Russian retains its existing partial release and English fallback.
The split does not add languages or change the interface.

This repository preserves the history of `apps/admin-ui` from the parent repository.
