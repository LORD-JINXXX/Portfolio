# Approved Cinematic Section Stack — exact Studio install

This patch is additive. It does not update, replace or delete any saved layout, collection, release or database row.

Prerequisite: apply it to the latest cumulative working baseline (or the restored `CINEMATIC-TRANSITION-STUDIO-PATCH.zip`) that already contains the Intro Sequence, Scene Frame and Cinematic starter creation path.

## Apply the code patch

1. Back up the latest working project.
2. Extract `CINEMATIC-SECTION-STACK-STUDIO-V2.zip`.
3. Open its `CINEMATIC-SECTION-STACK-STUDIO-V2` folder.
4. Copy that folder's contents over the project root, preserving the included paths.
5. Do not copy or delete `node_modules` from the patch. The patch adds no dependency and no database migration.
6. Restart the API and UI/UX Studio processes.

## Save the approved layout to the database

1. Open **UI/UX Studio**.
2. Click **Back to Layouts** if an editor is open.
3. Click **+ Cinematic Transition starter** exactly once.
4. Wait for **Cinematic Transition Portfolio created successfully.**
5. Click the new **Cinematic Transition Portfolio** card.

The button posts the approved starter document to the existing Studio layout endpoint. The API uses the existing atomic `create_layout_document` RPC to create a new layout row, draft version, design tokens and all nine pages together. It never writes into the current portfolio layout.

If a previous Cinematic Transition layout already exists, the database gives the new layout a collision-safe slug such as `cinematic-transition-portfolio-2`. The older layout remains unchanged and can be archived later only if you choose.

## Confirm the correct document opened

The Home page Layers tree must begin with:

```text
Home
├── Opening Film and Loader
└── Cinematic Section Stack
    ├── Hero Scene Frame
    ├── Tech Stack Scene Frame
    ├── Journey Scene Frame
    ├── Projects Scene Frame
    ├── Field Notes Scene Frame
    └── Finale Scene Frame
```

There must be one `Cinematic Section Stack`, not six independent tall interstitial frames.

## Edit and publish

- Select **Opening Film and Loader** → **Content** to edit the name, loader label, generic intro bridge text, video or poster.
- Select **Cinematic Section Stack** → **Content** → `bridgeText` to edit the persistent direction-neutral `COMING UP NEXT` copy.
- Select **Cinematic Section Stack** → **Props** to tune shared entry, exit and hold distances.
- Select a **Scene Frame** → **Props** to change that scene's entry and exit direction.
- Edit all scene content, styles, collections, bindings and animations normally.
- Click **Save**, then **Validate**, then **Publish** when ready.

## Approved runtime rules

- One document scroll owner.
- One sticky viewport stage.
- One persistent black bridge behind all scenes.
- Every scene reveals all of its content before its exit starts.
- Forward and reverse scrolling use the same deterministic measured timeline.
- Mobile and reduced-motion modes fall back to normal document flow.
- Existing `scene-transition`, `section-cover`, `stack-over-previous`, collections, runtime state and animation systems remain available for older documents.
