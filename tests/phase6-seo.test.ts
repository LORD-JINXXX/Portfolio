import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRobotsTxt, buildSitemapXml, resolveSeoMetadata } from '../apps/api/src/lib/seo'
import type { RuntimeManifest } from '@platform/contracts'

function manifest(): RuntimeManifest {
  return {
    releaseId: 'release-phase6',
    releaseNumber: 42,
    mediaSnapshotVersion: 1,
    schemaVersion: 3,
    runtimeMinVersion: '1.0.0',
    designTokens: { variables: {} },
    routes: [
      { path: '/', pageId: 'home', slug: 'home', name: 'Home', pageType: 'home', seo: { title: 'Home' }, schema: {} as any },
      { path: '/projects/:slug', pageId: 'projects-detail', slug: 'projects-detail', name: 'Project', pageType: 'collection_detail', collectionName: 'projects', seo: { canonical: 'https://evil.example/hijack' }, schema: {} as any },
      { path: '/private-preview', pageId: 'private', slug: 'private', name: 'Private', pageType: 'standard', seo: { noindex: true }, schema: {} as any },
    ],
    globals: {},
    content: {},
    settings: {
      'seo.site_url': 'https://portfolio.example',
      'seo.site_name': 'Mustafa Portfolio',
      'seo.default_description': 'Default portfolio description',
      'seo.title_template': '%s · %site%',
      'seo.language': 'en',
    },
    media: {
      'media-1': { id: 'media-1', url: 'https://cdn.example/project.jpg', alt: 'Project cover' },
    },
    collections: {
      projects: [{ id: 'project-1', slug: 'phase-6', title: 'Phase 6 Project', summary: 'A secure release-aware project.', thumbnail_media_id: 'media-1', updated_at: 'not-a-date' }],
    },
    generatedAt: 'also-not-a-date',
  }
}

test('Phase 6 SEO keeps canonical URLs on the configured public origin', () => {
  const seo = resolveSeoMetadata(manifest(), '/projects/phase-6', 'https://fallback.invalid')
  assert.ok(seo)
  assert.equal(seo.canonical, 'https://portfolio.example/hijack')
  assert.equal(seo.title, 'Phase 6 Project · Mustafa Portfolio')
  assert.equal(seo.image, 'https://cdn.example/project.jpg')
  assert.equal(seo.robots.startsWith('index,follow'), true)
})

test('Phase 6 sitemap is Active-manifest driven, excludes noindex and safely omits invalid dates', () => {
  const xml = buildSitemapXml(manifest())
  assert.match(xml, /https:\/\/portfolio\.example\//)
  assert.match(xml, /https:\/\/portfolio\.example\/projects\/phase-6/)
  assert.doesNotMatch(xml, /private-preview/)
  assert.doesNotMatch(xml, /<lastmod>/)
})

test('Phase 6 missing collection-detail item produces no SEO document', () => {
  assert.equal(resolveSeoMetadata(manifest(), '/projects/missing'), null)
})

test('Phase 6 robots keeps private account routes out of crawl targets and points to sitemap', () => {
  const robots = buildRobotsTxt(manifest())
  assert.match(robots, /Disallow: \/login/)
  assert.match(robots, /Disallow: \/register/)
  assert.match(robots, /Disallow: \/dashboard/)
  assert.match(robots, /Sitemap: https:\/\/portfolio\.example\/sitemap\.xml/)
})
