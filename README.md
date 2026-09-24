# Syntari

A renderer-first design system that agents can understand, use, verify, and evolve.

Syntari turns intent into interfaces using trusted components, design tokens, patterns, Screen IR, and a machine-readable registry. The UI source is open and editable.

![Syntari — components and agent patterns](preview.png)

## Documentation

Human-facing product and documentation:

- [syntariui.giovanitier.com](https://syntariui.giovanitier.com/)

Stable machine-readable and install surfaces:

- [Component gallery](https://syntariui.github.io/syntari/gallery.html)
- [Library](https://syntariui.github.io/syntari/library.html)
- [Registry](https://syntariui.github.io/syntari/registry/index.json)
- [Generative UI](https://syntariui.github.io/syntari/generative-ui.html)

## Install Syntari source

Syntari 0.2 is a **copy-source CLI**, not a package you import with `import ... from "syntari-ui"`.

From the consuming project:

```sh
npm exec --yes --package="https://syntariui.github.io/syntari/downloads/syntari-ui-0.2.2.tgz" -- syntari add app-shell
```

That creates `./components/syntari` with the selected component entry plus the shared runtime and registry.

Use the copied module:

```js
import { mount } from './components/syntari/app-shell.js';

const shell = await mount('#app');
```

Run the same package command with `syntari list` to inspect available component slugs. The CLI never overwrites customized component files.

## Components

125 component families and 250 authored preview states and layouts cover actions, form controls, navigation, data display, charts, overlays, tables, page blocks, chat, and agent interfaces.

Every component page includes Preview / Usage / Code, its element contract, runtime API, and guidelines. Installed examples use the same editable HTML, CSS, JavaScript runtime, tokens, and registry used by Syntari itself.

## Development

Use Node.js 22 or newer:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4318/ for the landing page, `/library.html` for the library, and `/gallery.html` for the gallery. Run `npm test` for the full browser and installer suite.

## Contributing

Please read the [contributing guide](./CONTRIBUTING.md).

## License

Licensed under the [MIT license](./LICENSE).
