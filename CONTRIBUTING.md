# Contributing

Thanks for your interest in Syntari. This guide covers local setup, checks, and how to propose changes.

## Local setup

Use Node.js 22 or newer:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4318/ for the landing page, `/library.html` for the library, and `/gallery.html` for the gallery.

## Checks

Run the full browser and installer suite before opening a pull request:

```sh
npx playwright install chromium
npm test
```

The suite covers every component route, authored preview state, theme, responsive layout, and the source installer.

## Components and tokens

Add or change components in `app.js`, `starter.js`, `agents.js`, and `extras.js`, then run `npm run build`. Keep components on the shared tokens in `tokens.css` and the motion system in `motion.js`. Describe new behavior in `HISTORY.md` when it is user facing.

Machine-readable component and token definitions live in `registry/`. Regenerate the index with:

```sh
node scripts/generate-registry.mjs
```

## Pull requests

- Keep changes focused, and explain the problem and the resulting behavior.
- Include the checks you ran.
- Match the existing code style, naming, and accessibility conventions.
- Keep commit messages clear and publishable.

## Installer releases

The source archive under `downloads/syntari-ui-<version>.tgz` is immutable once deployed.

If a change modifies `cli.mjs`, the generated `kit/`, runtime files, component source, registry data shipped in the archive, or installation behavior:

1. bump the version in `package.json` and `package-lock.json`;
2. update any release-facing documentation for that version;
3. never publish different bytes under an already deployed archive URL.

This matters for coding agents and CI because npm may cache URL packages by version. Reusing an archive version can make an agent install stale Syntari source even when the website shows newer code.

