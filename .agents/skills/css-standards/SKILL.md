---
name: css-standards
description: Enforce the current web CSS architecture and warm editorial styling conventions in this repository. Use when creating or changing styles, theming, design tokens, component visuals, layout classes, or page atmosphere in web/src/css.
---

# CSS Standards

## Scope

Applies to the web client styles under `web/src/css/` and class names used in `web/src/html/*.html` and `web/src/js/components/*.js`.

## Visual Direction

- The UI theme is warm and print-like, not dark, neon, or glass-heavy.
- Base colors should stay anchored to the current palette: soft paper background, green primary, plum accent, muted text, and restrained blue links.
- Surfaces should feel calm and tactile: soft white cards and panels, warm borders, modest gradients, and controlled shadows.
- Background atmosphere belongs in `base.css` and should stay subtle: layered gradients, low-contrast texture, and no loud decorative effects.
- Avoid reintroducing purple/cyan tech aesthetics unless the user explicitly asks for a different direction.

## Typography

- Use `--font-body` for normal UI copy and form controls.
- Use `--font-display` for hero headings, section headings, and brand-forward moments.
- Use `--font-mono` sparingly for pills, badges, or compact metadata that benefits from a coded label feel.
- Use Font Awesome for UI icons and keep icon styling tied to the package-provided CSS variables instead of version-pinned font-family names.
- The current stack is `Roboto`, `Raleway`, and `Source Code Pro`, defined across `base.css` and `tokens.css`.
- Do not add new font families in component files. If typography needs to change globally, update `base.css` and `tokens.css` together.

## Icons

- Font Awesome is the shared icon system for the web app and is loaded globally through `web/src/css/base.css`.
- Prefer semantic Font Awesome markup in HTML/JS components for visible controls, badges, and status affordances instead of emoji, ad hoc inline SVG fragments, or bespoke icon fonts.
- Keep visible labels alongside icons in buttons, chips, cards, links, and modal actions; icons support the label and should not replace it by default.
- When a pseudo-element icon is necessary, use the package-defined tokens such as `var(--fa-font-solid)` with the appropriate glyph content rather than hardcoded family names tied to a specific Font Awesome version.
- If an icon requires spacing, alignment, or color treatment, handle that in the component stylesheet instead of inline styles or one-off markup attributes.

## Core Rules

1. Keep page entry files such as `web/src/css/index.css`, `web/src/css/login.css`, and `web/src/css/dashboard.css` as composition layers: imports first, then only page-level layout and one-off page scaffolding.
2. Shared structural shells belong in reusable classes such as `.surface-host` and `.surface-card` from `web/src/css/components/surface.css`; keep semantic classes such as `.panel`, `.dashboard-section`, or `.filter-surface` alongside them in markup instead of re-encoding the shell in each component.
3. Each UI component must own its style file in `web/src/css/components/`; that file should style the semantic class, internals, and states, while structural shell rules stay in the shared surface layer and shared tokens.
4. If a page-specific component is a contextual variant of a reusable component, keep the shared visual primitive in the reusable component file and let the page-specific file contain only contextual overrides, extra affordances, and container-specific states.
5. If two or more page-scoped components share the same visual primitive and there is no clear reusable base component yet, extract a small shared partial or shared structural class instead of duplicating rules or pushing them back into the entry file.
6. Keep project-wide tokens in `web/src/css/tokens.css` under `:root`.
7. Never hardcode palette colors, fonts, radii, shadows, or repeated shell spacing in component files when an existing token or shared surface rule already covers the need.
8. For hover, focus, active, muted, and surface variations, prefer `color-mix(...)` with existing tokens.
9. Prefer nested CSS selectors within each component file to keep styles colocated and scoped.
10. Keep component-specific responsive rules in the same component file as the base styles they modify.
11. On phones, prefer flush section shells when they improve readability: page wrappers may drop outer padding to `0`, primary sections/panels/modals may use `var(--radius-sm)`, and the breathing room should move into inner headers, bodies, facts, nav blocks, and action rows instead of staying on the outer shell.
12. Restore the roomier framed-card treatment from the first upward breakpoint instead of preserving desktop gutters on narrow screens.
13. Keep interactions visually soft: subtle lift, border shifts, and shadow changes are preferred over aggressive transforms or high-contrast effects.
14. Do not introduce alternate icon systems or version-specific Font Awesome font-family strings in component CSS.

## Token Usage

Use shared token names from `tokens.css`:

- Typography: `--font-body`, `--font-display`, `--font-mono`
- Background/surfaces: `--color-background`
- Brand/accent: `--color-main`, `--color-main-alt`
- Contrast on colored surfaces: `--color-main-contrast`, `--color-alt-contrast`
- Text and links: `--color-text`, `--color-text-secondary`, `--color-link`
- Feedback: `--color-info`, `--color-success`, `--color-warning`, `--color-error`
- Structure: `--color-border`, `--color-shadow`, `--radius`, `--radius-sm`, `--radius-pill`
- Surface layout and shell tokens: use the shared `--space-*`, `--surface-*`, and host/content surface variables instead of inventing component-local spacing scales for repeated shell patterns.

## Structural Classes

- Use semantic classes for meaning, JS hooks, and page ownership: `.panel`, `.dashboard-section`, `.dashboard-settings-panel`, `.filter-surface`, `.card`.
- Add shared structural classes directly in markup when an element should receive a reusable shell pattern: `.surface-host` for large section/panel containers and `.surface-card` for inner card-like containers.
- Prefer multiple classes on one element over creating a new component selector just to restate border, radius, background, shadow, and base padding behavior.
- When rendering HTML from JS components, include the structural class in `className` so generated cards follow the same contract as server-rendered markup.
- Do not turn the repo into free-form utility soup; keep the utility layer small and structural. Semantic classes still own internals, variants, and behavior-specific states.

## Component Language

- `header.css` and `hero.css` define the public-facing visual identity. Keep them elegant and warm, with restrained gradients and clear framing.
- `panel.css` and `event-card.css` should read as paper surfaces: bright cards, soft borders, rounded edges, and careful shadows.
- When a dashboard or page-specific card builds on the same card surface and metadata structure, keep that base treatment in `event-card.css` and reserve the page-specific stylesheet for status colors, actions, feedback panels, and other local customizations.
- `button.css` uses an earthy, uppercase call-to-action language. Primary buttons lean brown, ghost buttons stay surface-based.
- Filter styles currently live in `index.css`, while form primitives live in `form.css`; preserve that split unless there is a clear reason to extract a new component file.
- Compact metadata elements such as pills, chips, and session badges should feel crisp and intentional, not flashy.
- If a special form control needs structural styling, prefer a small semantic class in HTML such as `.checkbox-field` rather than inline styles.

## Organization Pattern

- `index.css`: imports tokens/base/component files plus home-page filter and empty-state rules
- `login.css`: imports shared tokens/base/components plus auth-page layout and tabs rules
- `dashboard.css`: imports shared tokens/base/components plus dashboard page layout only
- `tokens.css`: color and spacing primitives
- `base.css`: reset, atmospheric background, global typography primitives
- `components/surface.css`: shared structural classes such as `.surface-host` and `.surface-card`
- `components/*.css`: component-specific nested rules, including page-specific partials such as dashboard shell, sections, cards, event rows, modal layouts, or small shared dashboard primitives when several dashboard components depend on the same base treatment

## Interaction with JS Components

When a component has visual state changes, toggle CSS classes in JS instead of writing inline styles.

Example pattern:

- JS toggles `alert--error` / `alert--success`, `tab--active`, `form--disabled`, `session-badge--active`, `card--past`
- CSS in the component file defines those variants with token-based colors and surface treatments

## Theming Guardrails

- Prefer warm neutrals and soft contrast over dramatic dark/light clashes.
- Keep gradients within the project palette and use them mainly for large branded surfaces.
- Use `--font-display` only where hierarchy or brand presence matters; do not turn body copy into display text.
- Preserve roomy spacing in forms and cards. The current UI should feel calmer and more breathable than the previous version.
- On phone layouts, do not force every section to remain a centered floating card if the page reads better with a flush mobile shell plus inner spacing.
- When in doubt, match the tone of `base.css`, `header.css`, `hero.css`, and `event-card.css` before inventing a new pattern.
- The `.github/references/` folder can be used as style inspiration for component ergonomics, but visual decisions must follow the live tokens and component files in `web/src/css/`.

## Review Checklist

- Do repeated shells use shared structural classes in markup instead of bespoke selector-only shells?
- Does each changed component map to a dedicated CSS file?
- Does the page entry file stay slim and act as composition instead of owning leaf component blocks?
- Do semantic classes and structural classes have separate responsibilities?
- Does the change preserve the warm editorial theme instead of drifting back to a dark or neon look?
- Are all colors, fonts, radii, and shadows tokenized via `var(--...)` where appropriate?
- Do icon treatments follow the shared Font Awesome setup and avoid ad hoc glyph systems or stale font-family names?
- Are tone variants created with `color-mix(...)`?
- Are nested selectors used for component internals/states?
- Do responsive overrides stay colocated with the component they modify?
- On phones, are outer section shells using the available width well, with spacing pushed inward instead of trapped in desktop-style wrapper padding?
- Are JS visual states represented by CSS classes (not inline styles)?
- Do headings, badges, buttons, and surfaces still match the current typography and component language?
