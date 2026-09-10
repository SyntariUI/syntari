# Orbit → Figma: source extraction

Step 1 extracts the current code into a machine-readable inventory. It does not create or update Figma objects.

Run from the repository with Node 22+ and the existing Playwright dependencies installed:

```sh
npm run figma:extract
```

The extractor starts a temporary server on a free localhost port, loads the actual Orbit runtime in Chromium, and closes both when finished. It uses the existing catalog and authored documentation recipes, not a separately maintained component list. It needs no Figma credentials or open Figma app. The local library is the input; no data is sent to Figma in this step.

Read [the extraction report](extracted/REPORT.md) for counts, button hierarchy findings, limitations, and every component's documented states.

| Output | Contents |
| --- | --- |
| `extracted/manifest.json` | Source revision and hashes, capture conditions, coverage, target file, limitations. |
| `extracted/tokens.json` | Every shared CSS token, original declarations, aliases, resolved light/dark values, and normalized colors, dimensions, durations, and easing. Shadows and font stacks retain their CSS source. |
| `extracted/components.json` | Catalog metadata, registration locations, original HTML and DOM trees, native control attributes, element contracts, authored state recipes, and enhanced default-state geometry/styles in both themes. |
| `extracted/styles.json` | CSS rules with selectors, conditions, declarations, token references, font faces, and keyframes. |
| `extracted/assets.json` | Actual Lucide SVG paths, font declarations, and asset hashes. |
| `extracted/button-audit.json` | Button treatments and occurrences in default component templates. The documentation shell and dynamically generated controls need a separate usage review. |
| `extracted/gaps.json` | Literal-color declarations and known conversion/coverage gaps. |

## Validation

Extraction fails if the browser and source catalogs differ, a shared token is omitted or unresolved, a foundational alias is missing, a component registration cannot be traced, a font asset is missing, an authored state fails to mount in either theme, geometry is invalid, a browser exception occurs, or a source file changes during extraction.

The output distinguishes authored **preview recipes** from reusable **variant axes**. For example, Button's default preview contains multiple visual styles, while its documented state picker contains Default, Primary, Destructive, and Disabled. These are not interchangeable counts. Some recipes describe a compact layout or an animation in progress. They should not be blindly turned into component variants.

Default geometry is captured in a 640px stage with reduced motion. It is evidence at one width, not a responsive design model. Generated DOM IDs are seeded for traceability; live runtime updates can still change snapshots. Matching CSS rules record selector matches in the light default DOM, not a complete cascade proof or the winning token binding. The full stylesheet inventory preserves dark, interaction, responsive, and pseudo-element rules for the next step.

## Next step

Use the extracted values to plan variable collections and aliases; verify OpenRunde's availability in Figma; define component properties and variant axes from the actual structure and behavior. Create native components, compare them visually with the browser, and only then add Code Connect mappings. Keep source provenance and returned Figma IDs together in a separate generation ledger.

Target: [Orbit in Figma](https://www.figma.com/design/0rv4sI7MUcEZaERaCJX8bt).
