# Cinematic Transition Portfolio — install and database creation

This is a cumulative, additive Studio patch. It preserves the existing Blank, Cosmic and AI Age starters and adds a separate **Cinematic Transition Portfolio** starter built from the approved shared-stage prototype.

## 1. Apply the patch

1. Back up the latest working project.
2. Extract the patch archive.
3. Copy the contents of its `CINEMATIC-TRANSITION-STUDIO-PATCH` folder over the project root, preserving the included paths.
4. Do not delete or replace any other project file.
5. Run the project’s normal dependency install only if dependencies are not already installed. This patch adds no package dependency and no database migration.
6. Restart the API and Studio development processes.

## 2. Create and save the layout in the database

No SQL insert or JSON import is required.

1. Open **UI/UX Studio**.
2. Return to **Layouts** if an editor is already open.
3. Click **+ Cinematic Transition starter** once.
4. Wait for **Cinematic Transition Portfolio created successfully.**
5. The new layout card appears in the Layout Library. Click it to open its draft in Studio.

That single button uses the existing atomic `create_layout_document` database RPC. It saves the layout row, draft version, design tokens and all nine starter pages together. A failure creates no partial layout.

After editing:

1. Click **Save** to persist the current draft.
2. Click **Validate**.
3. Fix any reported content or media requirements.
4. Click **Publish** to create the immutable published layout version.
5. In Admin, choose/configure that published layout version for a release using the existing release workflow.

## 3. What is editable

- `Opening Film and Loader` → **Content**: name, loading label, direction-neutral Coming Up Next text, video and poster.
- `Opening Film and Loader` → **Props**: loading, bridge and pixel-wipe timings.
- `Cinematic Section Stack` → **Content**: the single persistent bridge text.
- `Cinematic Section Stack` → **Props**: entry, exit, content-hold and bridge-hold distances.
- Each `Scene Frame` → **Props**: entry direction, exit direction, starts-visible and final-scene behavior.
- Every scene panel → normal **Style**, **Content**, **Props**, **Animation** and **Scroll** Inspector tabs.
- Runtime Preview includes Desktop, Tablet and Mobile width controls.
- Home copy, links and media use Editable Content bindings.
- Tech Stack uses `technology_categories` and `technologies` collections.
- Journey, Projects and Field Notes use `experience`, `projects` and `notes` collections.

The Home page defaults `tech.category` to `frontend`. Matching Technology Category `category_key` and Technology `category` values continue to drive the terminal filter and animation replay.

## 4. Motion behavior

- Intro: editable video/name loader from 0% through 100%, short Coming Up Next bridge, then a pixel wipe.
- One document scroll owner measures one sticky viewport stage. There are no nested scene scrollbars.
- Hero: starts visible behind Intro and exits upward.
- Tech Stack: enters from top and exits right.
- Journey: enters from right and exits bottom.
- Projects: enters from bottom and exits left.
- Field Notes: enters from left and exits upward.
- Finale: rises from the bottom, remains visible, then releases into the normal legal footer.
- Reverse scrolling reverses scene progress deterministically.
- The black bridge always says only `COMING UP NEXT`, so it is correct in both scroll directions.
- A scene completes its normal content travel before its directional exit can begin.
- Mobile uses normal document flow for scene panels.
- Reduced-motion users receive the non-directional fallback.

## 5. Verification completed

- Cinematic document: 9 pages, 129 nodes and 46 editable content slots.
- Starter validation: 0 errors and 0 warnings.
- TypeScript checks passed for Contracts, Builder Core, Runtime Renderer, Validation, Studio and API.
- Source lint passed.
- Main test suite: 282/282 passed.
- Static/migration integration suite: 190/190 code assertions passed in this archive environment; the one subprocess-only package-entry check requires reinstalling platform-native dependencies after extraction.
