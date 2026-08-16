import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COLLECTION_SCHEMA_SNAPSHOT_KEY, collectionDefinitionsSnapshot, definitionsFromSnapshot, MAX_COLLECTION_ARRAY_ITEMS, normalizeCollectionFields,
  normalizeCollectionItemData, normalizeCollectionItemShape, stripInternalCollectionMetadata, validateCollectionSnapshotIntegrity, type CollectionDefinition,
} from '../apps/api/src/lib/generic-collections.ts'

function mediaDb(ids: string[]) {
  return {
    from(table: string) {
      assert.equal(table, 'media')
      const builder: any = {
        select() { return builder },
        in(_field: string, requested: string[]) {
          return Promise.resolve({ data: requested.filter((id) => ids.includes(id)).map((id) => ({ id })), error: null })
        },
      }
      return builder
    },
  }
}

const fields = normalizeCollectionFields([
  { key: 'name', label: 'Project Name', type: 'text', required: true },
  {
    key: 'blocks',
    label: 'Content Blocks',
    type: 'array',
    itemLabelField: 'name',
    itemFields: [
      { key: 'name', label: 'Block Name', type: 'text', required: true },
      { key: 'block_type', label: 'Block Type', type: 'select', required: true, options: [{ label: 'Code', value: 'code' }] },
      { key: 'media_id', label: 'Media', type: 'media' },
    ],
  },
])

const definition: CollectionDefinition = {
  id: 'definition-id',
  key: 'project_details',
  label: 'Project Details',
  fields_json: fields,
  display_order: 0,
}

test('structured array schema preserves nested item fields and label field', () => {
  const blocks = fields[1]
  assert.equal(blocks.type, 'array')
  assert.equal(blocks.itemLabelField, 'name')
  assert.deepEqual(blocks.itemFields?.map((field) => field.key), ['name', 'block_type', 'media_id'])
})

test('plain array schemas remain backward compatible', () => {
  const [tags] = normalizeCollectionFields([{ key: 'tags', label: 'Tags', type: 'array' }])
  assert.equal(tags.type, 'array')
  assert.equal(tags.itemFields, undefined)
  assert.equal(tags.itemLabelField, undefined)
})

test('structured array item data is normalized recursively and validates nested managed media', async () => {
  const data = await normalizeCollectionItemData(mediaDb(['media-1']) as any, definition, {
    name: 'VisualBuild',
    blocks: [
      { name: 'VisualBuild — Architecture', block_type: 'code', media_id: 'media-1', ignored: 'drop-me' },
    ],
  })
  assert.deepEqual(data, {
    name: 'VisualBuild',
    blocks: [{ name: 'VisualBuild — Architecture', block_type: 'code', media_id: 'media-1' }],
  })
})

test('structured array rejects missing required nested fields', async () => {
  await assert.rejects(
    () => normalizeCollectionItemData(mediaDb([]) as any, definition, { name: 'VisualBuild', blocks: [{ block_type: 'code' }] }),
    /Block Name is required/,
  )
})

test('structured array rejects unknown nested managed media ids', async () => {
  await assert.rejects(
    () => normalizeCollectionItemData(mediaDb([]) as any, definition, { name: 'VisualBuild', blocks: [{ name: 'Architecture', block_type: 'code', media_id: 'missing-media' }] }),
    /Unknown managed media id: missing-media/,
  )
})


test('generic scalar constraints preserve unique + relation metadata', () => {
  const [projectSlug] = normalizeCollectionFields([{
    key: 'project_slug',
    label: 'Project Slug',
    type: 'text',
    required: true,
    unique: true,
    relation: { collection: 'projects', field: 'slug', requirePublished: true, targetCoverage: 'warning' },
  }])
  assert.equal(projectSlug.unique, true)
  assert.deepEqual(projectSlug.relation, { collection: 'projects', field: 'slug', requirePublished: true, targetCoverage: 'warning' })
})

test('structured/plain arrays enforce a bounded item count and normalized item payload', () => {
  const arrayDefinition: CollectionDefinition = {
    id: 'array-definition', key: 'large_array', label: 'Large Array', display_order: 0,
    fields_json: normalizeCollectionFields([{ key: 'items', label: 'Items', type: 'array' }]),
  }
  assert.throws(() => normalizeCollectionItemShape(arrayDefinition, { items: Array(MAX_COLLECTION_ARRAY_ITEMS + 1).fill('x') }), /at most/)

  const payloadDefinition: CollectionDefinition = {
    id: 'payload-definition', key: 'payload', label: 'Payload', display_order: 0,
    fields_json: normalizeCollectionFields([{ key: 'body', label: 'Body', type: 'textarea' }]),
  }
  assert.throws(() => normalizeCollectionItemShape(payloadDefinition, { body: 'x'.repeat(300 * 1024) }), /payload limit/)
})

test('required JSON rejects an empty object instead of treating it as authored content', async () => {
  const jsonDefinition: CollectionDefinition = {
    id: 'json-definition', key: 'json_items', label: 'JSON Items', display_order: 0,
    fields_json: normalizeCollectionFields([{ key: 'config', label: 'Config', type: 'json', required: true }]),
  }
  await assert.rejects(() => normalizeCollectionItemData(mediaDb([]) as any, jsonDefinition, { config: {} }), /Config is required/)
})

test('frozen custom schemas round-trip separately from runtime collection data', () => {
  const schemaDefinition: CollectionDefinition = {
    id: 'schema-id', key: 'project_details', label: 'Project Details', display_order: 2, fields_json: normalizeCollectionFields([{ key: 'project_slug', label: 'Project Slug', type: 'text', unique: true }]),
  }
  const snapshot = { projects: [{ slug: 'visualbuild' }], [COLLECTION_SCHEMA_SNAPSHOT_KEY]: collectionDefinitionsSnapshot([schemaDefinition]) }
  assert.equal(definitionsFromSnapshot(snapshot as any)[0].fields_json[0].unique, true)
  assert.deepEqual(stripInternalCollectionMetadata(snapshot as any), { projects: [{ slug: 'visualbuild' }] })
})

test('release snapshot integrity detects duplicate and orphan Project Details relations and reports uncovered Projects', () => {
  const relationDefinition: CollectionDefinition = {
    id: 'details', key: 'project_details', label: 'Project Details', display_order: 0,
    fields_json: normalizeCollectionFields([{
      key: 'project_slug', label: 'Project Slug', type: 'text', required: true, unique: true,
      relation: { collection: 'projects', field: 'slug', requirePublished: true, targetCoverage: 'warning' },
    }]),
  }
  const issues = validateCollectionSnapshotIntegrity({
    projects: [{ id: 'p1', slug: 'visualbuild', published: true }, { id: 'p2', slug: 'zovia', published: true }],
    project_details: [
      { id: 'd1', project_slug: 'visualbuild', published: true },
      { id: 'd2', project_slug: 'visualbuild', published: true },
      { id: 'd3', project_slug: 'missing-project', published: true },
    ],
  }, [relationDefinition])
  assert.ok(issues.some((entry) => entry.code === 'collection.unique-duplicate' && entry.severity === 'error'))
  assert.ok(issues.some((entry) => entry.code === 'collection.relation-missing' && entry.severity === 'error'))
  assert.ok(issues.some((entry) => entry.code === 'collection.relation-uncovered-target' && entry.severity === 'warning' && entry.message.includes('zovia')))
})
