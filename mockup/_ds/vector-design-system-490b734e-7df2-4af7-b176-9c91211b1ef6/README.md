# Vector — Design System

**Vector** is a dark-first design system for a modern **issue & project tracker** — the kind of fast, keyboard-driven workspace product teams use to plan, triage, and ship work. It provides the visual foundations (color, type, spacing, elevation), iconography guidance, and a high-fidelity UI kit so design agents and developers can build branded Vector interfaces — for production or throwaway prototypes — quickly and consistently.

> **Origin & scope.** This system was built from a set of reference screenshots of a commercial issue tracker (Linear). Rather than mirror that product's proprietary brand, Vector adopts the **structural and interaction conventions of the issue-tracker category** — a navigation rail, status-grouped issue lists, board/timeline views, rich filter & display popovers, a create-issue modal, and workflow iconography — under its **own original identity**: the name *Vector*, an azure accent, and an original logo. Use it to build your own product, not to reproduce another company's branding.

---

## Sources

- **Reference material:** `uploads/리니어 참고자료/` — 113 PNG screen captures of a live issue-tracker desktop app (issues list/board, projects board/timeline/list, inbox, filters, display options, create-issue modal, settings, sidebar customization). These were the primary visual reference for layout, density, and interaction patterns.
- No codebase or Figma file was provided; recreations are based on the screenshots plus the conventions of this product category.

---

## Index / Manifest

Root files:
- **`README.md`** — this file. Product context, content & visual foundations, iconography.
- **`colors_and_type.css`** — all design tokens as CSS custom properties (color, surfaces, borders, text, status/priority/label colors, radii, shadows, spacing, layout metrics) plus semantic type classes (`.v-h1`, `.v-ui`, `.v-mono`, …) and primitive helpers (`.v-btn`, `.v-chip`, `.v-input`, `.v-menu`).
- **`SKILL.md`** — Agent-Skill manifest for use inside Claude Code.
- **`CLAUDE.md`** — the rules that apply to every session in or from this system: reuse Vector code, copy dependencies, reserved signature icons, the **four tiers + discovery path**, **re-assign across surfaces (never shrink)**, **port vs reference discipline**, tokens, fonts.
- **`vector.profile.yaml`** — the project declaration: surfaces, deterministic core, ports & references, tier assignments per surface, `deferred` (with rationale) and the **`unbuilt` ledger** — what should exist and honestly does not yet.
- **`NOTICE.md`** — third-party attribution. Every external project this system learned from, its license, and whether it was a port or a reference. **Plane and Mattermost are AGPL and stay reference-only.**
- **`templates/tooling/check.mjs`** — zero-dependency validator for the profile + code (reserved-icon violations, nondeterminism in the core, hardcoded hex). Run `node templates/tooling/check.mjs`; in an environment without a shell, verify the same items by eye and report a table.
- **`docs/reference-notes/`** — one observation note per external source, written before implementing. A reference without a note is a port.

Folders:
- **`assets/`** — `vector-logo.svg` (the brand mark) and any other shared visual assets.
- **`preview/`** — small standalone HTML cards that populate the Design System tab (color scales, type specimens, status/priority icons, components).
- **`ui_kits/app/`** — the **Vector app** UI kit: a modular, interactive recreation of the core product (sidebar, tab bar, issue list & board, filter/display panels, create-issue modal). See its own `README.md`.
- **`icon_kit/`** — the **Vector multi-source icon kit**: one `<Icon>` API over 150+ open-source sets (Lucide+Radix primary; Tabler/Phosphor/Heroicons/Material Symbols secondary), with a semantic-alias registry and an offline build pipeline that emits a tree-shakeable npm package. Working gallery at `icon_kit/preview/index.html`; see its `README.md`.

---

## Products represented

There is **one product**: the **Vector desktop app** (an Electron-style web app). Within it, the major surfaces are:

| Surface | What it is |
|---|---|
| **Issues** | The core list — issues grouped by Status (and optionally sub-grouped by Project), with List and Board views. Tabs: All issues / Active / Backlog. |
| **My Issues** | Personal view with Assigned / Created / Subscribed / Activity tabs. |
| **Inbox** | Notifications feed with an empty state and filter/display controls. |
| **Projects** | Projects shown as Board (kanban by status), List, or Timeline (Gantt). |
| **Views** | Saved custom views for Issues and Projects. |
| **Settings / Preferences** | Full-screen settings shell with a categorized left nav (Preferences, Profile, Notifications, Labels, Templates, Members, …). |

---

## CONTENT FUNDAMENTALS

**Voice: terse, functional, lowercase-leaning, never chatty.** The UI speaks in the fewest words possible. It addresses the user implicitly — there is almost no "you" or "I"; labels are nouns and verbs, not sentences.

- **Casing:** **Sentence case everywhere.** Buttons, menu items, headers, and labels all use sentence case — "Create issue", "Add description…", "Show sub-issues", "Set default for everyone". Title Case is essentially never used. Acronyms stay upper (ID, SLA, API, AI). Issue IDs are uppercase team-prefix + number — `VEC-1`, `VEC-42`.
- **Labels are short noun/verb phrases:** "My issues", "In Progress", "No project", "Order completed by recency", "Show empty groups", "Filter by content…".
- **Placeholders use ellipsis:** "Issue title", "Add description…", "Project name", "Add a short summary…", "Filter…", "Try: 2 days, 3 weeks…".
- **Empty states are two words + an optional action:** "No notifications", "No issues assigned to you" → `Create new issue`.
- **Counts are bare numbers** next to a group label: "Todo  5", "No project  5", "Backlog  1". Time is abbreviated relative: "2mo", "9 days ago", "Updated May 3", "Feb 26".
- **Keyboard shortcuts are first-class** and shown inline in menus, right-aligned and dimmed: "Create issue  C", "Add link…  Ctrl Alt L", "Add sub-issue  Ctrl ⇧ O", "Send comment on…  Ctrl+Enter".
- **No emoji** in product chrome. (The app *supports* emoji in user content and has an emoji setting, but the interface itself never decorates with them.) **No exclamation marks** in system copy — the tone is calm and neutral.
- **Settings descriptions** are the one place with full sentences, still terse: "Select which view to display when launching the app", "Strings like :) will be converted to 🙂", "Change the cursor to a pointer when hovering over any interactive elements".

Examples to imitate:
> `Create issue` · `Make recurring…` · `Set due date  ⇧ D` · `Show sub-issues` · `Order completed by recency` · `Set default for everyone` · `No issues assigned to you` · `Filter by content…`

---

## VISUAL FOUNDATIONS

**Overall vibe:** a calm, near-black, information-dense workspace that feels fast. Flat surfaces, hairline borders, almost no shadow except on floating layers, tiny type, generous use of subtle gray. Color is reserved almost entirely for *meaning* (status, priority, labels) and for the single azure accent on primary actions — never for decoration.

### Color
- **Dark theme is the product.** Every reference screen is dark. The canvas is near-black (`--bg-app #08090A`); the sidebar is a hair different (`--bg-sidebar #0B0C0D`); floating layers (menus, modals) are a lifted charcoal (`--bg-elevated #18191B`) with nested menus one step lighter (`#202123`).
- **Translucent white does the work.** Hover and active states are `rgba(255,255,255,.045)` / `.075)`; borders are `rgba(255,255,255,.07–.11)`. This keeps everything cohesive on the dark base without hard lines.
- **Text is a 4-step gray ramp:** `#F7F8F8 → #C9CCD1 → #8A8F98 → #62666D` (primary → muted title → secondary/meta → tertiary/placeholder).
- **One brand accent: azure `#4C8DFF`.** Used for the primary button ("Create issue"/"Create project"), links ("Set default for everyone"), selected/active text, focus rings, and the "Done" status. Sparingly.
- **Status, priority, and label colors are functional**, not decorative: amber in-progress, green review, azure done, gray backlog/todo/canceled; orange urgent; red/purple/blue label dots. See tokens.

### Type
- **Pretendard** (primary), with **Inter** as a Latin fallback. Pretendard covers **Latin + 한글 in one family**, so English/Korean mix cleanly — important because the product ships in both languages. Weights 400/500/600/700; **500 (medium) is the workhorse** for nav, rows, and menus; 600 for titles, active items, and buttons. It's pulled in via `@import` inside `colors_and_type.css`, so linking that file is enough. Pretendard is open-source (SIL OFL) and safe to ship.
- **Small and dense.** Default UI text is **13px**; issue titles 14px; meta/timestamps 11–12px; the view title ("Issues") ~18px; settings page titles ~22px. Slight negative letter-spacing on large headings.
- Monospace only appears subtly (issue IDs read fine in Inter; a mono token is provided for code/diffs).

### Spacing, density & layout
- **4px base grid.** Rows are ~40px tall; small controls 28px; buttons 32px. Padding inside menus/rows is tight (6–10px).
- **Fixed app chrome:** a `232px` left sidebar (scrolls independently), a top tab bar (`~36px`) + view header (`~44px`), then the scrollable content. Right-hand **Filter** and **Display** popovers slide in as overlays anchored to toolbar icons; they do not push content.
- Content is left-aligned and full-width within the canvas; no centered max-width container (this is an app, not a marketing page).

### Backgrounds, texture, imagery
- **No gradients, no images, no illustrations** in the chrome. Backgrounds are flat solid fills. The only "art" is a couple of **line-art empty-state glyphs** (an inbox tray, a stacked-disc "no issues" mark) drawn in the same hairline style as the icons. Avatars are solid-color rounded squares with initials or a small mono-color portrait.

### Borders, corners, cards
- **Hairline borders** (`--border`) separate panels, menus, inputs, and board columns. **Radii are small:** 4px chips, 6px buttons/inputs/rows, 8px cards/menus, 12px modals; pills (999px) for filter chips and status counts.
- **Board cards** = `--bg-app`/very-subtle fill, 1px hairline border, 8px radius, minimal `--shadow-card`. **Menus & modals** get a soft drop shadow (`--shadow-popover` / `--shadow-modal`) plus a faint outline — that, not heavy elevation, is what reads as "floating".

### Motion, hover & press
- **Fast and subtle.** Transitions are ~120ms ease on background/border/opacity. No bounces, no large slides, no decorative animation.
- **Hover** = lighten via the translucent-white overlay (rows, menu items, ghost buttons) and bump text from `--fg-2` to `--fg`. Icon buttons get a faint round/rounded hover bg.
- **Press** = a barely-there `translateY(0.5px)` and the darker accent shade for primary buttons; selected nav items hold the `--bg-active` pill.
- **Focus** = 1px accent border + 3px `--accent-soft` ring on inputs.

### Transparency & blur
- Used sparingly: the modal scrim is `rgba(0,0,0,.55)`; hover/active overlays are translucent white. Backdrop blur is not central to the look — depth comes from the lifted charcoal surfaces + hairline outline + soft shadow.

### Iconography vibe
- Cool, monochrome, hairline. Icons inherit text color (gray by default, white on hover/active, azure when selected). See ICONOGRAPHY.

---

## ICONOGRAPHY

**Style:** thin-stroke (≈1.5px), rounded-join, monochrome **line icons** at 16px in chrome (14px inside dense rows, 20px for empty-state glyphs). Icons are not filled (except a few deliberately filled status/priority marks) and they **inherit the current text color** — gray `--fg-3` at rest, `--fg` on hover/active, `--accent` when selected.

- **Icon set / substitution:** the reference uses a bespoke line-icon set. Vector standardizes on **[Lucide](https://lucide.dev)** — the closest CDN-available match in stroke weight and rounded style. **⚠️ This is a substitution** for the original set; if you have the real icon SVGs, drop them into `assets/icons/` and prefer those. Load Lucide from CDN:
  ```html
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>lucide.createIcons();</script>
  ```
  Common mappings: Inbox→`inbox`, My issues→`target`/`crosshair`, Projects→`box`, Views→`layers`, More→`more-horizontal`, Search→`search`, Create→`pencil`/`square-pen`, Filter→`list-filter`, Display→`sliders-horizontal`, Notifications→`bell`, Settings→`settings-2`, Attach→`paperclip`, Back/Forward→`chevron-left`/`chevron-right`, History→`history`.

- **Status & priority icons are custom inline SVG**, not from Lucide, because their exact geometry carries meaning. They live in the UI kit (`StatusIcon`, `PriorityIcon`) and use the `--status-*` / `--priority-*` tokens:
  - **Status:** Backlog = dashed circle; Todo = hollow circle; In Progress = circle with a filled pie wedge (amber); In Review = circle with most of the ring filled (green); Done = filled circle + check (azure); Canceled/Duplicate = circle with an × (gray).
  - **Priority:** No priority = three faint dashes; Urgent = orange rounded square with a white "!"; High/Medium/Low = three signal bars with 3/2/1 bars active.
  - **Label dots** = solid 8px color dots using `--label-*`.

- **Logo:** `assets/vector-logo.svg` — an original azure rounded-square mark (a downward vector arrow with a node). Use it in the workspace switcher and login. It is original artwork, not derived from any third-party brand.

- **Emoji & unicode:** not used as interface iconography. Emoji only appears in user-authored content where the product allows it.

---

## How to use this system

1. Link `colors_and_type.css` and load Inter + Lucide.
2. Reach for tokens, never raw hex. Use `var(--bg-app)`, `var(--fg-3)`, `var(--status-progress)`, etc.
3. Compose screens from the `ui_kits/app/` components.
4. Keep copy terse and sentence-cased; keep color tied to meaning; keep type small and dense.

> **Font note:** The reference product (Linear) uses an Inter-derived custom typeface; Geist is a different (Vercel) font. Since Vector ships in **English and Korean**, this system uses **Pretendard** — an open-source family with Inter-like Latin and full Hangul coverage — as the primary font, with Inter as a Latin fallback. **Lucide** stands in for the icon set. All are close, free, and CDN-available; if you have specific brand font files or icon SVGs, drop them into `fonts/` and `assets/icons/` and I'll wire them in for an exact match.
