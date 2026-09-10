# Orbit × Be UI coverage

Reviewed September 10, 2026 against the navigation catalog at https://beui.dev/components/agents/todo-list.

The gallery now has **106 component families**, including **18 agent patterns**, and **four starter screens**. These are original, framework-independent Orbit implementations. Be UI supplies the behavioral reference, not the visual theme or application code.

## Agent patterns

| Reference | Orbit gallery |
| --- | --- |
| Message Bubble | Message bubbles |
| Message | Agent message |
| Message Scroller | Message scroller |
| Prompt Input | Prompt input |
| Todo List | Agent todo list |
| Code Block | Code block |
| Approval Card | Approval card; Agent questions |
| File Diff | File diff |
| Tool Result | Tool result |
| Streaming Response | Streaming response |
| Image Generation | Image generation |
| Tool Approval | Tool approval |
| Citations | Citations |
| Agent Activity | Agent activity |
| Agent Loading States | Agent loading states |
| AI Sidebar | AI sidebar |
| Chat App | Chat workspace |

## General components

| Reference | Orbit equivalent or adaptation |
| --- | --- |
| Number Animation | Rolling number; Attribution table |
| Range Slider | Range slider (two accessible bounds); Slider |
| Tilt Card | Tilt card, limited to a subtle 2-degree response |
| Button | Button |
| Animated CTA Buttons | Button; Action swap |
| Expandable Control | Expandable dock; Selection toolbar |
| Adaptive Stepper | Stepper; Number stepper |
| Marquee | Marquee with play/pause |
| Tabs | Tabs; Segmented control |
| Switch | Switch |
| Input | Text input |
| Select | Select & date |
| Combobox | Searchable select; Autocomplete |
| Multi Select | Multiselect |
| Checkbox | Checkbox & radio |
| Radio Group | Checkbox & radio; Selectable cards |
| Bottom Sheet | Bottom sheet |
| Pull to Refresh | Pull to refresh, plus visible button |
| Shared Layout Background | Segmented control; navigation active indicators |
| Bounce Sidebar | App shell, without decorative bounce |
| Animated Sidebar | App shell; starter screen navigation |
| File Tree | File tree |
| Preview Rail | Preview rail |
| Dock | Floating navigation; Expandable dock |
| Tooltip | Tooltip |
| Animated Context Menu | Context menu |
| Popover | Popover |
| Morphing Modal | Dialog; Side drawer, shared quiet entrance |
| Center Morph Modal | Dialog; Confirmation dialog |
| Text Animation | Streaming response; Action swap |
| Animated Badge | Badge & status; Agent task states |
| Action Swap | Action swap |
| Animated Toast Stack | Toast; Notification stack |
| Theme Toggle | Gallery light/dark control |
| Bouncy Accordion | Accordion, without overshoot |
| Drawer | Side drawer |
| Scroll Animation | Gallery reveal and Replay motion |
| Wheel Picker | Wheel picker |
| Table | Table; Data table; Attribution table |
| Shader Background | Ambient background (lightweight CSS adaptation, no WebGL) |
| Cylinder Carousel | Rotating carousel (flat staged adaptation, no 3D cylinder) |
| Loader | Skeleton & spinner; Agent loading states |

## Blocks

| Reference | Orbit equivalent or adaptation |
| --- | --- |
| Card Folder | Card & project folder |
| Infinite Masonry | Masonry grid, bounded and explicitly loaded |
| Notification Stack | Notification stack |
| Project Folder | Card & project folder |
| Fixtures | Fixtures |
| Availability Scheduler | Availability scheduler |
| Multi-chain Swap | Asset swap, local fixed-rate demonstration |
| Dynamic Island | Status island; Expandable dock |
| Command Palette | Command palette |
| Morphing Search | Morphing search |
| Expandable Action Bar | Selection toolbar; Expandable dock |
| Overflow Actions | Overflow actions; standard dropdown |
| Expandable Tabs | Tabs; Expandable dock |
| Morphing Tabs | Segmented control; Tabs |
| Swipeable List | Swipeable list, with equivalent buttons and undo |
| File Upload | File input; Upload progress |
| Prediction Market | Prediction card, local team forecast |
| Wallet Card | Wallet card, sample identifier and balance |
| OTP Input | OTP input, one labeled autofill-compatible field |
| Sign Up Form | Sign-in & onboarding starter screen |
| Bloom Menu | Bloom menu |
| Feedback Widget | Feedback widget |
| 404 / Not Found | Not found |

## Cohesion rules

- OpenRunde typography; shared semantic surface, border, accent, and status colors in both themes.
- Lucide icons from the existing local icon source, with its license retained.
- Existing pill actions, softened field corners, light borders, dark toast/dock surfaces, and quiet elevation.
- Short state transitions. No motion is required to understand an outcome. Reduced motion disables decorative movement and streaming reveals.
- The task plan exposes running, stopped, pending, and completed states. Approval outcomes stay visible; nothing is approved automatically.
- Menu items, date choices, forms, and overlay dismissal retain keyboard behavior. Table overflow stays inside the table.

## Limits of this milestone

This is a UI starter gallery, not a backend or a literal port of Be UI. Several reference motion variants are intentionally represented by the same Orbit primitive. CSS replaces the shader example; a staged carousel replaces the 3D cylinder; loading is bounded rather than infinite.

Chat, image generation, uploads, invitations, approvals, asset swaps, predictions, and authentication demonstrate local interaction states. They do not call model services, send messages, publish changes, connect wallets, or authenticate accounts. Profile preferences persist locally; the remaining sample data resets on reload.
