import assert from 'node:assert/strict'
import test from 'node:test'
import { blogManagedMediaIds, blogPlainText, estimateBlogReadingTimeMinutes, normalizeBlogContentBlocks } from '../apps/api/src/lib/blog-content.ts'
import { ADMIN_STRUCTURED_LIST_CONFIG } from '../apps/api/src/lib/admin-list-query.ts'
import { ADMIN_LIST_UI_CONFIG } from '../apps/admin/src/admin-list.ts'

const IMAGE = '11111111-1111-4111-8111-111111111111'

test('Blogs normalize complete section blocks that can combine text, media and code', () => {
  const blocks = normalizeBlogContentBlocks([
    {
      name: 'VisualBuild — Architecture',
      block_type: 'architecture',
      eyebrow: '01 / THE PROBLEM',
      heading: 'A visual editor backed by structured data',
      body: 'The same section can contain explanatory text, a managed diagram and implementation details.',
      media_id: IMAGE,
      media_alt: 'VisualBuild architecture diagram',
      code: 'type ComponentNode = { type: string }',
      language: 'typescript',
      caption: 'Simplified editor architecture',
      layout: 'split',
    },
  ])
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0]?.name, 'VisualBuild — Architecture')
  assert.equal(blocks[0]?.block_type, 'architecture')
  assert.equal(blocks[0]?.heading, 'A visual editor backed by structured data')
  assert.equal(blocks[0]?.body, 'The same section can contain explanatory text, a managed diagram and implementation details.')
  assert.equal(blocks[0]?.media_id, IMAGE)
  assert.equal(blocks[0]?.code, 'type ComponentNode = { type: string }')
  assert.equal(blocks[0]?.layout, 'split')
  assert.deepEqual(blogManagedMediaIds(blocks), [IMAGE])
  const text = blogPlainText({ title: 'Blog title', excerpt: 'Summary', content_blocks: blocks })
  assert.match(text, /VisualBuild — Architecture/)
  assert.match(text, /visual editor backed by structured data/i)
  assert.match(text, /ComponentNode/)
  assert.ok(estimateBlogReadingTimeMinutes(text) >= 1)
})

test('Blogs reject invalid section type, layout and managed media IDs', () => {
  const base = { name: 'Section', block_type: 'rich_text', heading: 'Heading', body: 'Body' }
  assert.throws(() => normalizeBlogContentBlocks([{ ...base, block_type: 'unknown' }]), /Unsupported blog block type/i)
  assert.throws(() => normalizeBlogContentBlocks([{ ...base, layout: 'floating' }]), /layout/i)
  assert.throws(() => normalizeBlogContentBlocks([{ ...base, media_id: 'not-a-uuid' }]), /media UUID/i)
})

test('Patch 12/13 semantic blog blocks remain readable and are normalized to section blocks', () => {
  const blocks = normalizeBlogContentBlocks([
    { type: 'heading', name: 'Architecture section', text: 'Architecture', level: 'h2' },
    { type: 'paragraph', text: 'A long-form paragraph.' },
    { type: 'image', media_id: IMAGE, caption: 'Architecture diagram', full_width: true },
    { type: 'code', code: 'const ok = true', language: 'typescript', filename: 'example.ts' },
  ])
  assert.deepEqual(blocks.map((block) => block.block_type), ['rich_text','rich_text','image','code'])
  assert.equal(blocks[0]?.heading, 'Architecture')
  assert.equal(blocks[1]?.body, 'A long-form paragraph.')
  assert.equal(blocks[2]?.layout, 'full')
  assert.equal(blocks[3]?.code, 'const ok = true')
  assert.deepEqual(blogManagedMediaIds(blocks), [IMAGE])
})

test('Blogs Admin UI and server list query contracts stay aligned', () => {
  const ui = ADMIN_LIST_UI_CONFIG.blogs
  const server = ADMIN_STRUCTURED_LIST_CONFIG.blogs
  assert.equal(ui.defaultSort, server.defaultSort.field)
  assert.equal(ui.defaultDirection, server.defaultSort.direction)
  assert.ok(server.searchFields.includes('search_text'))
  for (const option of ui.sorts) assert.ok(server.sortFields.includes(option.value))
  for (const filter of ui.filters) assert.ok(Object.hasOwn(server.filterFields, filter.field))
})
