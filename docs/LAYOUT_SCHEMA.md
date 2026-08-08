# Layout Schema

The canonical TypeScript/Zod contracts live in `packages/contracts/src/index.ts`.

## Editor document

An `EditorDocument` owns layout metadata, design tokens and all pages for one layout version.

Each `EditorPage` stores:

- stable page ID
- name and slug
- page type
- route pattern
- SEO defaults
- sort order
- `LayoutPageSchema`

System pages use `_header` and `_footer`. Ordinary pages are routed by `routePattern`.

## Studio nodes

`StudioNode` is a generic tree node with:

- `type` / optional HTML `tag`
- `props`
- responsive `styles`
- optional absolute/flow layout metadata
- `bindings`
- animation config
- section scroll behavior
- child nodes
- editor/admin metadata
- accessibility metadata

## Binding sources

- `static`: belongs to the layout.
- `content`: Admin-editable content slot with key, label, type, sample/fallback and required flag.
- `setting`: global site setting.
- `media`: stable CMS media ID/sample URL.
- `field`: current structured-record field inside a repeater/detail template.
- `collection`: query definition for projects, notes, experience, apps, or future registered collections.

Admin content values never contain layout styles. Layout JSON never becomes the sole storage location for structured project/note/experience/app records.

## Responsive inheritance

Runtime resolution is:

```text
desktop base
  + tablet overrides (tablet/mobile)
  + mobile overrides (mobile only)
```

## Schema/runtime compatibility

Published versions carry `schema_version` and `runtime_min_version`. Validation blocks activation when the deployed runtime cannot satisfy the minimum version.
