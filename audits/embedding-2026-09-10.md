# Orbit integration audit — September 10, 2026

## Verdict

**The documented installer works.** A fresh project successfully installed the archive, mounted a button and slider, received callbacks, and preserved locally customized files. Orbit intentionally distributes editable HTML/CSS/JS source rather than an npm runtime dependency or React package. Neither choice prevented Mentionloom from installing it.

The integration problems happened after installation. The consumer dashboard also introduced its own layout and density overrides, so a successful install or an automated accessibility score does not establish visual fidelity to Orbit.

## Reproduced against upstream `02a8359` / 0.2.0

Run from the repository:

```sh
npm test -- checks/embedding.spec.mjs checks/installer.spec.mjs
```

The initial four integration checks failed; the existing clean-project installer check passed.

| Check | Observed before the fix | Change prepared for 0.2.1 |
| --- | --- | --- |
| Enhance copied markup | A plain wrapper changed from block/zero padding to flex, 22px 20px padding, 17px gap, and 195px minimum height | `prepare()` adds behavior without the gallery layout class. `mount()` retains the preview layout on its own inserted wrapper. |
| Host keyboard shortcut | Mounting a button intercepted Ctrl/Command K and opened the sample palette instead of the host’s search | Embedded palette shortcuts are scoped to the focused prepared palette region. The gallery retains its global shortcut. |
| Read/update a select in `onAction` | Selecting Design studio still exposed Personal workspace to the consumer callback | Callbacks execute after native event dispatch; detached/reset instances cannot receive stale callbacks. |
| Format a discovery metric | The number runtime rendered and announced `0.481` when asked for percentage formatting | Added fractional percentage formatting with one decimal: `48.1%`. This is an API addition, not a previously documented format. |

The first three fixes each passed their isolated regression test before the next change was applied. The percentage addition also passed its isolated check. Further regression coverage verifies the embedded palette still works in its own region and that both reset and destroy cancel queued callbacks.

## Validation

`npm test`: **26 passed**, including the seven new integration regressions, the clean-project 0.2.1 archive install, and the existing gallery, documentation, control, motion and responsive suites. The generated catalog contains 107 components and 250 authored states.

## Cause

The reusable runtime and gallery share infrastructure. `prepare()` coupled enhancement to the gallery’s `specimen-body` layout. A document-level capturing keyboard listener assumed it owned the whole page. `mount()` queued consumer callbacks as microtasks, which a browser can execute between native event listeners, before Orbit’s document-level control handler. The number formatter implemented number/currency only.

## Remaining product work

These are explicit boundaries, not additional installer failures:

1. **Stylesheet isolation:** `styles.css` still contains broad element and gallery selectors, such as `main`, `.brand`, `.rank-name` and `dialog`. Separate the docs/gallery shell from consumer foundations, then scope component rules or define cascade layers. Add a host-style regression fixture before doing that refactor.
2. **Typography and density tokens:** the palette/spacing/radius tokens are reusable, but many component text and target sizes are literal pixel values. Establish compact and comfortable density contracts centrally. Mentionloom currently supplies its own 16px body / 14px supporting / 44px control theme; that theme is not an upstream Orbit feature.
3. **Overlay and icon ownership:** the shared runtime has generic support IDs and broad data selectors. Mentionloom uses application-specific IDs/attributes to avoid collisions. Scope these contracts before claiming components are isolated from arbitrary host markup.
4. **Distribution size:** adding one component still copies the full shared runtime. Documented behavior, but splitting runtime modules would improve adoption in existing apps.
5. **Accessibility coverage:** a Lighthouse 100 on one dashboard state is not full WCAG conformance or proof that every Orbit component is accessible. Test actual component states, both densities, contrast on tinted surfaces, keyboard flows and assistive technologies.

## Release and consumer migration

The fixes are prepared on `fix/embedded-runtime-contract` as version **0.2.1**. The changed download name avoids silently replacing the published 0.2.0 archive. Publishing still requires merging/releasing this change through Orbit’s existing workflow.

After release, install 0.2.1 into a new directory, compare local customizations, and migrate the consumer. Mentionloom can then remove its manual `specimen-body` removal and local percentage formatter extension. App-level filter handlers must still let Orbit’s event dispatch finish if they bypass `mount` callbacks. Density and namespace workarounds remain necessary until the corresponding upstream work is done.
