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

Shared components are an immutable npm archive in `vendor/`, maintained in `piperhex/remoteai/shared`.
Translations come directly from a pinned [remoteai-i18n release](https://github.com/piperhex/remoteai-i18n/releases).
There is no language archive or editable translation table in this repository. `vendor/source-lock.json`
records provenance and npm's lockfile records package integrity. All resources are bundled for offline use.
Run `npm run export:admin-ui -- /path/to/remoteai-admin-ui` from the parent to update shared components
and pin its selected language release, then run `npm install` and `npm run check` here. The ownership check
also runs independently with `npm run check:i18n` using the package's `admin-ui` integration profile.

Chinese and English remain complete; Russian retains its existing partial release and English fallback.
The split does not add languages or change the interface.

This repository preserves the history of `apps/admin-ui` from the parent repository.
