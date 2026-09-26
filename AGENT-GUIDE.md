# Syntari agent integration

Use Syntari as a bounded interface renderer. Retrieve its current contracts before composing a screen.

1. Run `syntari list --json`, `syntari patterns --json`, and `syntari info <id> --json` to discover components and authored patterns. The registry JSON is included in the package and served at `/registry/` on the site.
   Read `syntari registry policy --json` for the machine-readable rendering and action boundary.
2. Choose a pattern and components that fit the user's intent. Use only component ids declared by the registry. Prefer an authored manifest with `props` and `ir`; other components are documented but cannot render from Screen IR yet.
3. Produce JSON that matches `registry/schema/sui.schema.json`. Keep values inside each manifest's prop types, enum values, ranges, and list limits. Put evidence and provenance in labelled regions when a decision needs explanation.
4. Run `syntari validate --spec screen.json --json` or call `validateScreen(spec)` from `syntari-ui`. Repair every error before presenting the screen. Preserve warnings in the decision trace.
5. Render with `render(spec, target)` from the installed browser runtime. Show the intent, selected pattern, candidate components, decision, Screen IR, validation results, and rendered interface so a person can inspect why the screen looks as it does.

## Action boundary

Screen validation controls UI composition. A button or approval card is a visual affordance; it does not grant permission to run a tool. The host application must keep authentication, tool allowlists, data scope, and human approval in trusted code outside the model's Screen IR. A model-provided `approved: true` value is not evidence of human consent.

For a consequential action, the host should validate its arguments and scope, obtain approval through its own trusted state, then execute the action. Show the outcome and any failure in a new validated Screen IR result. Never infer permission from a rendered component or a model-authored provenance field.

## Example

```js
import { getPattern, validateScreen } from 'syntari-ui';

const { screen } = await getPattern('release-review');
const { ok, diagnostics } = await validateScreen(screen);
if (!ok) return { status: 'repair', diagnostics };
return { status: 'ready', screen, diagnostics };
```
