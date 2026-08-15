# AI Age Portfolio — Studio starter

This additive patch adds a third built-in Studio starter without replacing the existing Blank or Cosmic starters and without changing the database schema.

## What the starter contains

- 10 editable Studio pages: global Header, Home, Projects index/detail, Notes index/detail, Apps, About, Contact, and global Footer.
- A cinematic homepage with Hero orbit system, perspective grid, ambient code, moving capability marquee, collection-backed project cards, collection-backed experience, stateful Tech Stack console, About/Learning card, and contact finale.
- Desktop, Tablet, and Mobile styles on the main layout structures.
- Existing production runtime effects only: Fade/Reveal, Orbit, Spin, Float, Pulse, Tilt, Typewriter, Code Stream, Particle Field, and Ambient Field.
- Admin Editable Content keys for the authored text and links.
- Existing Projects and Experience collection bindings.
- Existing dynamic Tech Stack architecture:

  `technology_categories → tech.category → technologies`

The original reference's pointer-coordinate glow is represented with native Ambient/Particle/Grid layers because Studio currently has no pointer-position binding. The reference's automatic capability cycling is intentionally represented by collection-driven category buttons so the layout remains editable and uses the platform's existing runtime state/replay behavior.

## Install the patch into the cumulative project

1. Extract `AI-AGE-STUDIO-LAYOUT-PATCH.zip`.
2. Copy its contents into the root of the latest cumulative Dynamic Portfolio Platform project.
3. Merge folders and allow these patch files to overwrite only files with the same paths. Do not replace the whole project with the patch folder.
4. No new npm dependency and no Supabase migration is required.
5. Restart the running platform so the API and Studio load the new source:

   ```bash
   npm run dev
   ```

## Create and save the layout in the database

1. Open Studio at `http://localhost:3002` and sign in.
2. On the **UI/UX Studio** Layout Library screen, click **+ AI Age Portfolio starter**.
3. Wait for **AI Age Portfolio created successfully.** Studio will open the newly persisted draft automatically.
4. Inspect Desktop, Tablet, and Mobile, then click **Save** after any edit.

That single starter click sends this existing authenticated request:

```json
POST /api/studio/layouts
{
  "template": "ai-age",
  "name": "AI Age Portfolio"
}
```

The API builds the document and calls the existing `create_layout_document` database RPC. The RPC atomically creates:

- one row in `layouts`;
- one draft row in `layout_versions`;
- all 10 rows in `layout_pages`.

If the transaction fails, no partial layout is left behind. The created layout then appears in the Layout Library like every other editable Studio layout. Later edits continue through the existing **Save**, **Validate**, and **Publish** lifecycle.

## Collection prerequisites

The layout works with the collections already present in the cumulative baseline:

- `projects`
- `experience`
- `technology_categories`
- `technologies`

For the capability console, each published `technology_categories.category_key` must exactly match the `technologies.category` value. `frontend` remains the initial `tech.category` state.

## Validation completed

- AI Age document: 10 pages, 202 editable runtime nodes.
- Schema validation: 0 errors, 0 warnings.
- Builder Core, Studio, API, and Validation TypeScript checks passed.
- Full automated test suite passed (278/278).
