# Syntari interaction and layout audit — 10 September 2026

This report records local verification of the revised Syntari source, documentation, and installation archive before publication. Figma generation remains paused; its source inventory has been refreshed.

## Findings and corrections

| Area | Finding | Implemented correction |
| --- | --- | --- |
| Shared layout | The starter stylesheet changed every `.stack` from flex to grid, stretching actions and breaking centered empty states. | Scoped grid layouts to the forms that need them; restored natural button widths and alignment. |
| Disclosures and folders | An open ancestor rotated every nested icon. Tree summaries pushed labels to the far edge. | Named icon classes, direct-child chevron rotation, aligned tree labels, explicit expand indicators, and corrected nested width. |
| Motion in documentation | Entrance observation covered gallery specimens only, and startup depended on an event that could already have fired in embedded pages. | Observe mounted components too; initialize correctly before or after document readiness. |
| Secondary actions | Cancel, Discard, and several standalone controls used ghost styling. | Added `.button.secondary` with a subtle filled surface; applied it to the relevant actions and documented it in the extraction. |
| Dialogs | Body content, command results, and footer spacing were inconsistent. Time controls occupied too much horizontal space. | Separate scrollable content from fixed headings/actions; add consistent gaps; use a compact time dialog and responsive calendars. |
| Form controls | Range inputs used browser-blue tracks, numeric buttons could become oval, and password content could overflow. | Reused Syntari range styling and fill behavior; fixed circular stepper sizing; constrained password input and visibility control; themed autofill. |
| File selection | Selected files retained empty-state copy and had no clear removal action. | Selected-asset state with filename, local-file notice, Replace asset, and Remove selected file. |
| Notifications and swipe list | Removal was abrupt and remaining rows jumped. | Exit animation followed by position transitions; insertion and undo retain row identity. |
| Export action | Preparing and completed states had little visual feedback. | Busy state, spinner, animated label/icon changes, completion styling, and a repeatable action. |
| Scheduler, OTP, feedback | Confirmations were plain text while the original actions remained unchanged. | Selected and confirmed treatments; verified OTP state resets when edited; feedback submission changes the action and animates confirmation. |
| Upload and unsaved changes | Upload completion retained an unavailable Cancel action; the save bar appeared abruptly. | Completion icon/status, Cancel only while uploading, animated save-bar visibility, and focus restoration after save/discard. |
| Carousel, tilt, thumbnails | Both carousel arrows pointed right; image cards lacked response; tilt actions only changed a message. | Correct previous arrow, directional card transitions, hover elevation/artwork response, pointer tilt and light, and an actual project detail dialog. |
| Search, fixtures, wallet | Search count grammar and result layout were rough; fixture selection lacked a visible marker; concealment changed abruptly. | Aligned inline search, singular/plural counts, selected fixture styling, and animated balance feedback. |
| Mounted forms | Radio-name scoping broke named form fields in isolated examples such as Agent questions. | Preserve names inside forms; scope only radio groups without a form owner. |
| Simple data table | The existing table carried search, filters, selection, and pagination beyond the requested simple list. | Added a separate, quiet table with one project per row and typed sortable cells. |

## Simple data table

Project identity and owner, status badge, progress, budget, date, and detail action share one line with quiet separators. Each data heading sorts in both directions. Numeric values sort numerically; dates sort chronologically. Rows keep their DOM identity and animate to their new positions. Editing a record updates the row and retains the active sort. Small screens scroll within the table, without widening the page.

[Open the working table](https://giovanitier.github.io/syntari/components/simple-data-table/) · [Open the gallery](https://giovanitier.github.io/syntari/gallery.html)

## Verification

- Full 18-test suite passed after the main implementation, including gallery, motion, numeric controls, forms, agent flows, installer, and documentation.
- After the final table synchronization change, all 11 targeted documentation, installer, and polish tests passed, including the added record-editing regression. There are 19 unique passing tests across these runs.
- All 107 documentation routes responded successfully; all 250 authored preview recipes mounted without errors.
- All 107 default previews were checked at 390, 768, and 1440 pixels, in light and dark: 642 layout combinations, zero horizontal overflow failures outside intentional internal scrolling.
- A separate smoke audit exercised 234 local action handlers without runtime errors. This supplements the outcome-based tests; it is not a claim that every possible action sequence was tested.
- Keyboard navigation, focus return, mobile modal boundaries, range bounds, repeated save-bar changes, file replacement/removal, notification dismissal, upload cancellation, OTP editing, and reduced-motion outcomes were checked directly.
- Saved 21 final visual captures, including both themes and a mobile table view. Selected captures were visually inspected alongside the supplied screenshots.
- Source extraction: 107 families, 250 authored states, 500 state/theme mounts, 137 tokens, 72 theme overrides, and no missing documented token references or extraction errors.
- Build and whitespace checks passed.

## Visual evidence

[Simple table — light](simple-data-table-light.png) · [Simple table — dark](simple-data-table-dark.png) · [Mobile table](simple-table-mobile.png)

[File tree](file-tree-light.png) · [Empty state](empty-state-light.png) · [Selected asset](file-input-dark.png) · [Confirmed time](availability-scheduler-light.png)

[Date range — dark](date-range-picker-dark.png) · [Share workspace](bottom-sheet-light.png) · [Notifications — dark](notification-stack-dark.png) · [Completed export](action-swap-light.png)

## Scope

These remain local demonstration components. Existing upload, messaging, wallet, and other sample actions do not connect to external services. The browser checks use Chromium; separate Safari/Firefox and assistive-technology certification were not performed. The Figma inventory is source evidence, not native Figma components or a complete interaction-state matrix.
