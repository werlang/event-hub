---
name: css-standards
description: Enforce the current web CSS architecture and warm editorial styling conventions in this repository. Use when creating or changing styles, theming, design tokens, component visuals, layout classes, or page atmosphere in web/src/css.
---

# CSS Standards

## Scope

Applies to the web client styles under `web/src/css/` and class names used in `web/src/html/*.html` and `web/src/js/components/*.js`.

## Visual Direction

- The UI theme is warm, paper-like, and editorial, not dark, neon, or glass-heavy.
- Base colors should stay anchored to the current palette: soft paper background, sage primary, earthy brown secondary, muted text, and restrained blue links.
- Surfaces should feel calm and tactile: soft white cards and panels, warm borders, modest gradients, and controlled shadows.
- Background atmosphere belongs in `base.css` and should stay subtle: layered gradients, low-contrast texture, and no loud decorative effects.
- Avoid reintroducing purple/cyan tech aesthetics unless the user explicitly asks for a different direction.

## Typography

- Use `--font-body` for normal UI copy and form controls.
- Use `--font-display` for hero headings, section headings, and brand-forward moments.
- Use `--font-mono` sparingly for pills, badges, or compact metadata that benefits from a coded label feel.
- Do not add new font families in component files. If typography needs to change globally, update `index.css` and `tokens.css` together.

## Core Rules

1. Keep CSS bundled through `web/src/css/index.css`, but modularized with `@import` per component file.
2. Each UI component must own its style file in `web/src/css/components/`.
3. Keep project-wide tokens in `web/src/css/tokens.css` under `:root`.
4. Never hardcode palette colors, fonts, radii, or shadows in component files when an existing token already covers the need.
5. For hover, focus, active, muted, and surface variations, prefer `color-mix(...)` with existing tokens.
6. Prefer nested CSS selectors within each component file to keep styles colocated and scoped.
7. Keep interactions visually soft: subtle lift, border shifts, and shadow changes are preferred over aggressive transforms or high-contrast effects.

## Token Usage

Use shared token names from `tokens.css`:

- Typography: `--font-body`, `--font-display`, `--font-mono`
- Background/surfaces: `--color-background`
- Brand/accent: `--color-main`, `--color-main-alt`
- Contrast on colored surfaces: `--color-main-contrast`, `--color-alt-contrast`
- Text and links: `--color-text`, `--color-text-secondary`, `--color-link`
- Feedback: `--color-info`, `--color-success`, `--color-warning`, `--color-error`
- Structure: `--color-border`, `--color-shadow`, `--radius`, `--radius-sm`, `--radius-pill`

## Component Language

- `topbar.css` and `hero.css` define the public-facing visual identity. Keep them elegant and warm, with restrained gradients and clear framing.
- `panel.css` and `event-card.css` should read as paper surfaces: bright cards, soft borders, rounded edges, and careful shadows.
- `button.css` uses an earthy, uppercase call-to-action language. Primary buttons lean brown, ghost buttons stay surface-based.
- `filter-form.css` and `form.css` favor generous spacing, rounded inputs, warm borders, and accessible focus rings.
- Compact metadata elements such as pills, chips, and session badges should feel crisp and intentional, not flashy.
- If a special form control needs structural styling, prefer a small semantic class in HTML such as `.checkbox-field` rather than inline styles.

## Organization Pattern

- `index.css`: imports only (fonts + tokens/base/layout + components)
- `tokens.css`: color and spacing primitives
- `base.css`: reset, atmospheric background, global typography primitives
- `layout.css`: width, spacing, and page layout utilities
- `components/*.css`: component-specific nested rules
- `responsive.css`: cross-component responsive overrides only

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
- When in doubt, match the tone of `base.css`, `topbar.css`, `hero.css`, and `event-card.css` before inventing a new pattern.

## Review Checklist

- Does each changed component map to a dedicated CSS file?
- Does the change preserve the warm editorial theme instead of drifting back to a dark or neon look?
- Are all colors, fonts, radii, and shadows tokenized via `var(--...)` where appropriate?
- Are tone variants created with `color-mix(...)`?
- Are nested selectors used for component internals/states?
- Are JS visual states represented by CSS classes (not inline styles)?
- Do headings, badges, buttons, and surfaces still match the current typography and component language?
