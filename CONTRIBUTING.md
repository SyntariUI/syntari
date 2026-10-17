# Contributing

Thanks for your interest in Syntari. This guide covers local setup, checks, and how to propose changes.

## Local setup

Use Node.js 22 or newer:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4318/ for the homepage, `/system/` for the component workspace, and `/renderer/` for the Screen IR renderer.

## Checks

Run the Node and browser suites before opening a pull request:

```sh
npx playwright install chromium
npm test
npm run test:browser
```

`npm test` covers the registry, CLI, and Node API. `npm run test:browser` runs every Playwright suite in `checks/`: component routes and behaviour, authored preview states, both themes, responsive layouts, and the source installer. CI runs both.

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
