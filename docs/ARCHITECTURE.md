# Dynamic Portfolio Platform — Implemented Architecture

This repository follows `portfolio.md` as the canonical architecture.

## Applications

- `apps/web`: public portfolio runtime and normal user authentication/dashboard shell.
- `apps/admin`: structured CMS, visual site-content editing, layout library, releases and settings.
- `apps/studio`: visual design authoring for layouts, pages, styles, bindings, animations and scroll behavior.
- `apps/api`: trusted Node/Express coordination layer for Studio/Admin mutations, publication and public runtime delivery.

## Shared runtime path

```text
Studio authoring -> canonical EditorDocument -> published LayoutVersion
                                         |
                                         v
                                runtime-renderer
                               /       |        \
                       Studio preview Admin     Public Web
                                      preview
```

Admin does not mutate layout styles. Studio does not activate production. Public Web does not ship editor code.

## Content path

```text
Studio content slot -> Admin content revision -> Site release snapshot -> Runtime manifest
```

Structured records such as projects, notes, experience and AI app catalog remain in dedicated tables and are rendered through collection bindings.

## Release path

```text
Published layout version
+ published content revision
+ settings snapshot
+ structured collection snapshot
+ referenced media snapshot
= immutable site release candidate
```

Activation and rollback use the PostgreSQL `activate_release` function so the active release transition is atomic.
