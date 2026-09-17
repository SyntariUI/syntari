# Syntari interface quality audit

Date: 13 September 2026
Baseline: `main` at `c71faa385b2a56f6c4366e3f816a875190b7824a`
Decision: Syntari has a coherent visual direction, but its navigation and composed screens are not yet at the quality of the supplied references. A shared navigation foundation is the highest-impact next investment.

This is an audit and proposed specification. No application source was changed.

## Scope and evidence

Reviewed supplied navigation references, the documentation/library shell, the project and team starter navigation, the App shell component, button specimens, tokens, layout CSS, and event handlers. Ran Chromium inspections at 1440 × 1000, 1024 × 900, and 390 × 844; reviewed light and dark desktop screens, keyboard interaction, phone navigation, and a phone configuration with coarse pointer input. Checked normal and reduced-motion Bloom interactions. Static comparison screenshots use reduced motion to keep captures settled.

This is a focused navigation and interface-craft audit, not a certification of all 107 components. Safari, Firefox, VoiceOver, browser zoom, RTL, performance profiling, and every component state were not tested. Reference images establish visual intent; their real dimensions, responsiveness, accessibility, and behavior cannot be established from cropped screenshots.

Measured evidence: [navigation-evidence.json](navigation-evidence.json), [interaction-evidence.json](interaction-evidence.json). Relevant screenshots appear below.

## What the references do well

The dark sidebar gives identity, search, navigation groups, and the active destination distinct visual roles. Icon and text alignment is consistent. The active row is visible at a glance. Its surface hierarchy helps locate the sidebar relative to the content.

The light interface aligns the page action, tabs, data, and project details to a common grid. Borders are quiet and consistent. A small amount of inset highlight and shadow gives the primary action definition. Metadata is arranged as a readable label/value system, with avatars and badges integrated into the rows.

For Syntari, carry over this hierarchy and precision using Syntari's rounded type, blue accent, and existing icon family. Tune muted colors against actual contrast measurements. The reference's green glow is a stylistic choice; it is not evidence of usability or a requirement for Syntari.

## Additional navigation reference

This is the closest visual benchmark for Syntari among the supplied images. Its refinement comes from consistent relationships between elements, with very little ornament. The supplied crop shows a sidebar and a contextual breadcrumb header; it does not establish all behavior for a separate topbar layout.

| Visible quality | Why it works | Syntari application |
| --- | --- | --- |
| Compact brand header with collapse control on the same row | Identity and shell control form one clear unit | Replace the starter's separate collapse row with a header slot. Support a compact brand header and an optional workspace switcher using the same spacing rules. |
| “Monitor”, “Govern”, and “Prove” group labels | The grouping expresses different purposes and gives the list rhythm | Group Syntari destinations by their actual purpose; define one group heading style and consistent spacing before and after groups. |
| Consistent icon column and label start | The eye can scan vertically without adjusting for each row | Use a fixed 20px icon slot, an 8px gap, a common text baseline, and the same row inset throughout. |
| Active “Policies” row with a quiet fill, brighter label, and blue icon | Several restrained cues agree about the current destination | Use a shared selected-row token, medium text, and Syntari's accent icon. Keep keyboard focus visually distinct. |
| Small count badge aligned at the trailing edge | Counts do not disturb the label alignment | Reserve a trailing badge slot; use semantic status color only when the count represents that status. |
| Utilities anchored at the bottom | Persistent utilities are easy to find and do not interrupt primary navigation | Separate the scrollable destination groups from the persistent utility/footer area. Test short viewport heights so neither area overlaps. |
| Matte canvas, sidebar, panel, and nested content tones | Surface boundaries establish hierarchy without heavy shadows | Define a small semantic surface ladder that works in both themes. Match border strength and corner treatment across adjacent panels. |
| Neutral navigation surrounding selectively colored workflow nodes | Color directs attention to meaning in the content | Keep navigation mostly neutral. Define accent/status surfaces for content with readable foreground pairs. |
| Breadcrumb, local tabs, title, and panels occupy separate bands | Global location and local page controls are easy to distinguish | Document the hierarchy from app navigation to breadcrumbs to page tabs, with one shared content gutter. |

The image also makes the first implementation priority more precise: build the compact sidebar header, grouped link rows, selected state, and pinned utilities as one complete composition. Then render the same navigation data in a topbar layout. The initial proposed values below are Syntari design targets, not pixel measurements inferred from this scaled crop.

Keep the rounded type and existing icon family. Monospaced group labels are an optional treatment to compare in context; they should not become a new font rule across all navigation. The screenshot demonstrates resting and selected appearances only. Hover, focus, collapse, mobile, and motion behavior still need explicit design and verification in Syntari.

## Blocking defects

### B1. Collapsed navigation loses accessible names

**Evidence:** After collapsing the starter sidebar, its accessibility tree contains three unnamed buttons. The App shell demo does the same. At 1024px, CSS automatically hides the starter labels, reproducing the issue without any user action. The collapse control still reports `aria-expanded="true"` in that automatically collapsed layout.

**Impact:** Assistive technology cannot identify the destinations. Sighted users also lose the text without receiving hover/focus labels.

**Fix:** Keep an accessible name on every destination independently of visual label visibility. Use destination links with `aria-current="page"` when they navigate. Add hover/focus labels to the icon rail, and derive the collapse control's state from the actual layout. Keep the rail state when changing routes.

**Source:** `starter.js:46`, `starter.js:129`, `starter.js:177–180`; `starter.css:5–7`. The route reset was reproduced: choosing People after collapsing expands the new screen again.

**Acceptance:** All destinations remain named in expanded, collapsed, and responsive states. The collapse button matches the rendered state. Keyboard users can identify and visit every destination. [Name, Role, Value guidance](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html).

### B2. The starter mobile menu lacks a usable dismissal model

**Evidence:** At 390px, the open product sidebar overlaps the trigger and content. Escape and clicking outside leave it open. The trigger continues to be named “Open product navigation” while `aria-expanded` is true. The visible sidebar control says “Collapse product sidebar,” which is a desktop rail action, rather than a clear close action.

**Impact:** The user enters an overlay without a clear, dependable way back to the page. The documentation menu and product menu behave differently: the documentation menu does close on Escape.

**Fix:** Share one mobile drawer: a visible 44px close control, Escape, outside/scrim dismissal, focus return, and route-selection dismissal. If it behaves as a modal drawer, make the background inert and contain focus. Keep the drawer within the viewport and preserve its scroll position.

**Source:** `starter.js:178`, `starter.css:7`; documentation comparison in `docs.js:183–187`.

**Acceptance:** Open → close by control, Escape, outside click, and destination selection; verify focus location after each. [Current mobile state](projects-mobile-menu.png).

### B3. The authored sidebar focus ring fails contrast in both themes

| Theme | Ring | Adjacent sidebar | Measured contrast |
| --- | --- | --- | --- |
| Light | `#b5b3f9` | `#fafafa` | 1.87:1 |
| Dark | `#1710d5` | `#181925` | 1.72:1 |

These are computed CSS colors from a keyboard-focused documentation link. The external ring is the authored focus treatment and should reach at least 3:1 against the adjacent background. [Non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

**Fix:** Define focus colors semantically per theme, independently of the palette's numbered accent steps. As starting values, the existing accent-text colors produce 5.46:1 in light and 8.51:1 in dark against these sidebar surfaces. Verify them against all control surfaces and states. Retain a clear outline with an offset; increasing thickness alone will not correct the color contrast.

**Source:** `tokens.css:3–6`, `styles.css:59`.

### B4. Bloom fails on repeated use and shifts under reduced motion

**Evidence:** Normal motion, first open: all three options have computed opacity 1. Open → close → reopen: all three settle at opacity 0, with a retained animation on each button. Under reduced motion, the options' center is 639px while the trigger center is 560px: a 79px shift.

**Cause:** Exit animations retain their final styles through `fill:'forwards'`. Reopening does not clear them. The reduced-motion rule removes every descendant transform, including the transform used to center the options.

**Fix:** Cancel or replace previous animations and clear retained exit effects; make transitions interruptible. Separate structural positioning from animated transforms so reduced motion changes movement without changing layout.

**Source:** `extras.js:30–36`, `extras.css:1`, `extras.css:44`.

**Acceptance:** Three consecutive open/close cycles, rapid reversal, option selection, and reduced-motion changes preserve visibility and centering. Existing first-use tests did not cover this regression. [Interaction measurements](interaction-evidence.json).

## Important design and system gaps

### I1. There is no shared sidebar/topbar navigation offering

Three implementations exist: the documentation shell, the starter shell, and the compact App shell component. Their layouts and event handlers are separate. The catalog exposes App shell, but no complete standalone Sidebar or Topbar navigation variant. The current product topbar contains breadcrumb and search; it does not expose primary destinations as an alternative to the sidebar.

**Fix:** Create one navigation model and shared primitives, with `sidebar` and `topbar` layouts. Share destination identity, selection, badges, grouping, search, account controls, permissions/visibility, and mobile behavior. Let the library demo switch layouts with a segmented control. Keep page tabs and breadcrumbs as separate navigation levels.

**Source:** `docs.js:48`, `starter.js:46`, `starter.js:129`, `scripts/catalog.mjs`. The App shell description currently says composed screens use the same pattern, but they do not reuse its rendering implementation.

### I2. Navigation density has no consistent scale

| Element | Current measurement | Proposed starting standard |
| --- | --- | --- |
| Documentation sidebar | 244px wide; 11px labels; 33px rows; 14px icons | 264px wide; 14px/20px labels; 44px rows; 20px icons |
| Starter sidebar | 190px wide; 13px labels; 43.5px rows | Same navigation primitives and density vocabulary |
| Collapsed starter rail | 64px wide; 43 × 42px destination controls | 68px rail with centered 44px targets |
| Group heading | 10px | 12px/16px, regular or medium |
| Product menu on a touch device | 35 × 35px | 44 × 44px |
| Product search on a touch device | 71 × 20px, named only “⌘ K” | 44px target with “Search workspace” name |

The numbers proposed here are design targets, not measurements of the reference images. A 44px target is a comfort standard for Syntari. WCAG 2.2 AA has a 24px minimum with spacing and other exceptions, so smaller-than-44 does not alone establish a failure. [Target size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**Fix:** Introduce explicit comfortable and compact density tokens. Use comfortable density for app navigation. A compact documentation view can show more items while retaining legibility, names, and keyboard behavior. Test long labels, counts, and localized text.

### I3. Workspace identity and utilities remain placeholders

The starter header is a 24px-high wordmark row. The account footer is static content. There is no workspace switcher, account menu, or dedicated search entry inside the sidebar. The separate collapse control consumes an entire row between the brand and navigation.

**Fix:** Provide a compact brand-header variant and a workspace-switcher variant. For the switcher, start with a 56–64px identity control with a 32px avatar/mark, 14px primary label, 12px secondary label, and disclosure affordance. Give it actual open/selected states and truncation rules. Put the collapse affordance into the header. Add a 40–44px search control where search is offered, and a functional utility/account footer. Represent empty, long-name, and multi-workspace cases.

**Source:** `starter.js:129`, `starter.css:5`.

### I4. Surface hierarchy is too weak in dark mode

The starter sidebar and its main content both compute to `rgb(24, 25, 37)`. A single thin divider carries most of the separation. Selected rows, segmented choices, field surfaces, and cards use closely related tones with little role distinction.

**Fix:** Define roles for canvas, navigation, content panel, raised panel, hover, and selected state. Use a neutral or subtly tinted tonal ladder with Syntari blue reserved for selected indicators and meaningful accents. Test an inset main panel with a 16–20px radius. Following the additional sidebar reference, start selected navigation with a quiet fill, medium label weight, and accent icon; use a focus outline independently. Evaluate an inset marker only if these cues are insufficient in a particular navigation density.

**Source:** `tokens.css:3–5`, `docs.css:2`, `starter.css:5`. [Dark project screen](projects-desktop-dark.png).

### I5. Buttons and corners need a clearer hierarchy

Primary specimen buttons are 36px high with 12px labels and a 999px radius. Icon buttons are 35px squares. The default primary action uses the general subtle shadow; its stronger primary shadow appears on hover. Most action roles inherit the same pill silhouette. The second reference gives its page action a more defined edge and a distinct rounded-rectangle shape.

**Fix:** Define explicit action sizes of 32/40/44px, 14px labels for standard actions, and a consistent 8px icon gap. Trial 10–12px corners for standard actions and fields, pills for segmented controls and filters, circles for icon actions. Apply a restrained inset edge and short shadow to the primary action's resting state, with modest hover and pressed changes. Give controls their full target size before adding icon padding.

**Source:** `styles.css:2`, `motion.css:8–19`, `tokens.css:8–9`. [Current buttons](buttons-desktop-light.png).

### I6. Syntari needs a complete project-detail composition

The current project starter shows a title, counts, a note, and a table. The supplied light reference goes further: page-level tabs, structured metrics, a contextual right rail, editable metadata, and consistent actions. Syntari's existing metadata, table, header, form, and badge components can support this, but no starter currently proves that combination.

**Fix:** Establish one project-detail reference screen with a shared title/action baseline, content tabs, a flexible main column and a 288–320px details rail, 24px main gutter, and 20–24px panel padding. Stack the rail below content or place it in a named drawer when space is insufficient. Use semantic page titles, grouped metadata, and the same controls in all contexts.

The docs wrapper is appropriate for browsing, but a standalone “Open full screen” preview would let users judge a product shell without a second surrounding navigation system. [Current composed starter](projects-desktop-light.png).

## Proposed navigation contract

| Area | Sidebar layout | Topbar layout | Shared rules |
| --- | --- | --- | --- |
| Identity | Compact brand header or workspace switcher | Leading brand/workspace control | Same identity model, menu where applicable, loading and long-name states |
| Primary destinations | Grouped vertical links | Horizontal links plus overflow | Same route IDs, labels, icons, badges and selected state |
| Search | Dedicated entry below identity | Trailing search control | Same command surface, accessible name and shortcut |
| Account/utilities | Anchored footer | Trailing controls | Same account menu and disclosure behavior |
| Secondary navigation | Nested group where needed | Secondary row or overflow menu | Explicit hierarchy; page tabs remain distinct |
| Compact behavior | Labeled icon rail | Overflow menu | Accessible names remain available; no clipped items |
| Phone behavior | Shared drawer | Shared drawer | Clear close, Escape, focus return and route dismissal |
| Theme and motion | Shared tokens | Shared tokens | Stable layout under reduced motion; visible focus in both themes |

These are recommended component responsibilities. Validate concrete product requirements before claiming visual or behavioral parity with any reference.

## Implementation order

1. **Repair the blockers.** Accessible names, focus contrast, mobile dismissal, and Bloom repeat-use/reduced-motion bugs. Add focused regression coverage for these transitions.
2. **Define the shared foundations.** Navigation density, spacing, type, corners, surfaces, icon spacing, and interaction states. Keep definitions centralized rather than appending another layer of overrides.
3. **Build Sidebar and Topbar from shared primitives.** Show both on the same component page, with expanded/compact/mobile states. Preserve current destination and relevant user state across layout or route changes.
4. **Finish one project-detail screen in both layouts and themes.** Use the references as a craft benchmark and inspect real data, long labels, tables, menus, and editable details.
5. **Propagate the accepted system through the library.** Check all remaining components at 320/390/768/1024/1440 widths, keyboard and coarse pointer, normal and reduced motion, and light/dark. Follow with Safari, Firefox, VoiceOver, 200% zoom, and RTL checks before public-library readiness claims.

Completion means the same controls remain recognizable and dependable in the gallery, documentation, installed components, and composed screens. Performance budgets and frame-time profiling should be part of the implementation pass; this review did not measure those.

## Strengths to preserve

- Syntari already has an identifiable voice through rounded typography, a restrained blue accent, and a consistent icon family.
- The library exposes live examples, source, and state controls in a unified browsing shell.
- The sampled neutral navigation text is readable: approximately 5.50:1 in light and 9.21:1 in dark against the sidebar surfaces. The focus-ring defect is a separate issue.
- Tables, headers, forms, avatars, and metadata primitives provide a useful base for a complete project-detail experience.

Start with the shared navigation foundation and prove it in one complete screen. That will establish a concrete quality standard for the rest of Syntari.


## Navigation implementation follow-up

The inspected topbar reference uses 12px medium destination labels, 36px rows, 8px corners, and a light gray active fill. Its workspace header and navigation occupy separate bands; utility buttons use a subtle border and short shadow.

Syntari now translates that treatment into a 232px sidebar with 40px rows, 18px icons, a compact workspace selector, grouped links, pinned project shortcuts, and bottom utilities. The same navigation markup becomes a two-band topbar. Existing Syntari typography, icons, accents, and theme tokens remain in use. The library sidebar uses the same selection treatment and larger, consistently aligned icons.

The App shell example and starter screens share `navigation.js` and `navigation.css`. Navigation preferences survive screen changes; layout changes preserve the current form DOM. A standalone `preview.html` provides an uncluttered comparison. The navigation work addresses B1 (collapsed accessible names/state), B2 (mobile dismissal/focus), and B3 (semantic focus color). B4 (Bloom reopen/reduced-motion defects) remains a separate finding; this navigation change does not alter Bloom.
