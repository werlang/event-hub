---
name: css-standards
description: Enforce web CSS architecture and styling conventions in this repository. Use when creating or changing styles, component visuals, layout classes, or design tokens in web/src/css.
---

# CSS Standards

## Scope

Applies to the web client styles under `web/src/css/` and class names used in `web/src/html/*.html` and `web/src/js/components/*.js`.

## Core Rules

1. Keep CSS bundled through `web/src/css/index.css`, but modularized with `@import` per component file.
2. Each UI component must own its style file in `web/src/css/components/`.
3. Keep project-wide tokens in `web/src/css/tokens.css` under `:root`.
4. Never hardcode colors in component files; always use `var(--...)` tokens.
5. For color variations (hover/active/subtle surfaces), prefer `color-mix(...)` with existing tokens.
6. Prefer nested CSS selectors within each component file to keep styles colocated and scoped.

## Token Usage

Use shared token names from `tokens.css`:

- Background/surfaces: `--color-background`, `--color-surface`, `--color-surface-strong`
- Brand/accent: `--color-main`, `--color-main-alt`, `--color-main-soft`
- Text: `--color-text`, `--color-text-secondary`
- Feedback: `--color-info`, `--color-success`, `--color-warning`, `--color-error`
- Structure: `--color-border`, `--radius`, `--grid-gap`, `--shadow-soft`

## Organization Pattern

- `index.css`: imports only (fonts + tokens/base/layout + components)
- `tokens.css`: color and spacing primitives
- `base.css`: reset, body, global typography primitives
- `layout.css`: page layout utilities
- `components/*.css`: component-specific nested rules

## Interaction with JS Components

When a component has visual state changes, toggle CSS classes in JS instead of writing inline styles.

Example pattern:

- JS toggles `alert--error` / `alert--success`
- CSS in the component file defines those variants with token-based colors

## Review Checklist

- Does each changed component map to a dedicated CSS file?
- Are all colors tokenized via `var(--...)`?
- Are tone variants created with `color-mix(...)`?
- Are nested selectors used for component internals/states?
- Are JS visual states represented by CSS classes (not inline styles)?
