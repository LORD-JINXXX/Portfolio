import { DEFAULT_DESIGN_TOKENS, LAYOUT_SCHEMA_VERSION, type CollectionName, type ConditionalStyleRule, type EditorDocument, type EditorPage, type StudioNode } from '@platform/contracts'
import { createBlankDocument, createEmptyPage, createNode, genId, slugify } from './editor-state'

function contentNode(type: any, text: string, key: string, label: string, styles: Record<string, string | number | boolean | null | undefined> = {}, required = false): StudioNode {
  return createNode(type, {
    props: { text },
    bindings: { text: { type: 'content', key, label, contentType: 'text', sample: text, required } },
    styles: { desktop: styles },
    meta: { label, adminLabel: label },
  })
}

function fieldNode(type: any, field: string, fallback: string, styles: Record<string, string | number | boolean | null | undefined> = {}): StudioNode {
  return createNode(type, {
    props: { text: fallback },
    bindings: { text: { type: 'field', field, fallback } },
    styles: { desktop: styles },
    meta: { label: field },
  })
}

function section(label: string, background: string, children: StudioNode[], stackOrder: number): StudioNode {
  return createNode('section', {
    meta: { label, sectionLabel: label, adminLabel: label },
    scrollBehavior: { mode: 'stack-over-previous', stickyTop: 0, stackOrder, mobileFallback: 'normal', reducedMotionFallback: 'reduce' },
    styles: {
      desktop: {
        minHeight: '100vh', padding: '96px 6vw', position: 'relative', overflow: 'hidden',
        background, color: 'var(--site-text)', borderTop: '1px solid var(--site-border)',
      },
      mobile: { minHeight: 'auto', padding: '72px 22px' },
    },
    children,
  })
}

function createHeaderPage(): EditorPage {
  const page = createEmptyPage('Header', 'system')
  page.slug = '_header'; page.routePattern = '__header'; page.sortOrder = -100
  const brand = contentNode('span', 'Mustafa', 'site.brand.name', 'Brand Name', { fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em' }, true)
  const nav = createNode('nav', {
    styles: { desktop: { display: 'flex', alignItems: 'center', gap: '22px' }, mobile: { gap: '12px', fontSize: '13px' } },
    children: [
      createNode('a', { props: { text: 'Home', href: '/' }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none' } } }),
      createNode('a', { props: { text: 'Projects', href: '/projects' }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none' } } }),
      createNode('a', { props: { text: 'Notes', href: '/notes' }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none' } } }),
      createNode('a', { props: { text: 'About', href: '/about' }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none' } } }),
      createNode('a', { props: { text: 'Contact', href: '/contact' }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none' } } }),
    ],
  })
  page.schema.root = [createNode('header', {
    meta: { label: 'Global Header', sectionLabel: 'Header', adminLabel: 'Header' },
    styles: { desktop: { position: 'sticky', top: 0, zIndex: 1000, width: '100%', padding: '18px 5vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(7,7,10,.82)', backdropFilter: 'blur(18px)', color: 'var(--site-text)', borderBottom: '1px solid var(--site-border)' } },
    children: [brand, nav],
  })]
  return page
}

function createFooterPage(): EditorPage {
  const page = createEmptyPage('Footer', 'system')
  page.slug = '_footer'; page.routePattern = '__footer'; page.sortOrder = 10000
  page.schema.root = [createNode('footer', {
    meta: { label: 'Global Footer', sectionLabel: 'Footer', adminLabel: 'Footer' },
    styles: { desktop: { padding: '56px 6vw', background: '#050507', color: 'var(--site-muted)', borderTop: '1px solid var(--site-border)', display: 'flex', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' } },
    children: [
      contentNode('p', 'Built with the Dynamic Portfolio Platform.', 'footer.copyright', 'Footer Copyright', { margin: 0 }),
      createNode('div', { styles: { desktop: { display: 'flex', gap: '16px' } }, children: [
        createNode('a', { props: { text: 'GitHub' }, bindings: { href: { type: 'setting', key: 'site.social.github', label: 'GitHub URL', sample: 'https://github.com/' } }, styles: { desktop: { color: 'var(--site-text)' } } }),
        createNode('a', { props: { text: 'LinkedIn' }, bindings: { href: { type: 'setting', key: 'site.social.linkedin', label: 'LinkedIn URL', sample: 'https://linkedin.com/' } }, styles: { desktop: { color: 'var(--site-text)' } } }),
      ] }),
    ],
  })]
  return page
}

function createHomePage(): EditorPage {
  const page = createEmptyPage('Home', 'home')
  page.schema.initialState = { 'tech.category': 'frontend', 'tech.visibleCount': 0, 'journey.active': 1 }
  page.seoDefaults = { title: 'Mustafa — Full Stack Developer', description: 'Portfolio, projects, notes and applications.' }

  const hero = section('Hero', 'radial-gradient(circle at 75% 25%, rgba(124,58,237,.24), transparent 34%), radial-gradient(circle at 18% 70%, rgba(34,211,238,.13), transparent 28%), var(--site-bg)', [
    createNode('div', {
      styles: { desktop: { width: 'min(1200px, 100%)', minHeight: '70vh', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr .9fr', alignItems: 'center', gap: '64px' }, tablet: { gridTemplateColumns: '1fr', gap: '40px' } },
      children: [
        createNode('div', { children: [
          contentNode('p', 'FULL STACK DEVELOPER', 'home.hero.eyebrow', 'Hero Eyebrow', { color: 'var(--site-accent)', letterSpacing: '.18em', fontWeight: 700, fontSize: '12px', marginBottom: '18px' }),
          contentNode('h1', "Hi, I'm Mustafa.", 'home.hero.heading', 'Hero Heading', { fontSize: 'clamp(52px, 8vw, 112px)', lineHeight: '.94', letterSpacing: '-.065em', margin: 0, maxWidth: '900px' }, true),
          contentNode('p', 'I build polished web experiences and full-stack products.', 'home.hero.description', 'Hero Description', { fontSize: 'clamp(17px, 2vw, 22px)', lineHeight: 1.6, color: 'var(--site-muted)', maxWidth: '680px', marginTop: '28px' }, true),
          createNode('div', { styles: { desktop: { display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '34px' } }, children: [
            createNode('a', { props: { text: 'Explore my work', href: '/projects' }, bindings: { text: { type: 'content', key: 'home.hero.primary_cta_label', label: 'Primary CTA Label', contentType: 'text', sample: 'Explore my work' }, href: { type: 'content', key: 'home.hero.primary_cta_url', label: 'Primary CTA URL', contentType: 'url', sample: '/projects' } }, styles: { desktop: { display: 'inline-flex', padding: '14px 22px', borderRadius: '999px', background: 'var(--site-primary)', color: '#fff', textDecoration: 'none', fontWeight: 700 } } }),
            createNode('a', { props: { text: 'Connect with me', href: '/contact' }, bindings: { text: { type: 'content', key: 'home.hero.secondary_cta_label', label: 'Secondary CTA Label', contentType: 'text', sample: 'Connect with me' }, href: { type: 'content', key: 'home.hero.secondary_cta_url', label: 'Secondary CTA URL', contentType: 'url', sample: '/contact' } }, styles: { desktop: { display: 'inline-flex', padding: '14px 22px', borderRadius: '999px', border: '1px solid var(--site-border)', color: 'var(--site-text)', textDecoration: 'none' } } }),
          ] }),
        ] }),
        createNode('div', {
          animation: { type: 'float', trigger: 'continuous', duration: 4200, easing: 'ease-in-out', repeat: true },
          styles: { desktop: { minHeight: '440px', borderRadius: '48% 52% 45% 55%', border: '1px solid rgba(124,58,237,.45)', background: 'radial-gradient(circle at 40% 35%, rgba(34,211,238,.26), transparent 18%), radial-gradient(circle at 55% 60%, rgba(124,58,237,.38), transparent 35%), #0b0b11', boxShadow: '0 0 120px rgba(124,58,237,.18)', position: 'relative' }, mobile: { minHeight: '320px' } },
          children: [contentNode('p', 'YOUR IMAGE / COSMIC VISUAL', 'home.hero.visual_caption', 'Hero Visual Caption', { position: 'absolute', inset: 'auto 0 28px', textAlign: 'center', color: 'var(--site-muted)', letterSpacing: '.12em', fontSize: '11px' })],
        }),
      ],
    }),
  ], 1)
  hero.scrollBehavior = { mode: 'normal' }
  hero.bindings = { ...(hero.bindings || {}), 'style.backgroundImage': { type: 'content', key: 'home.hero.background_image', label: 'Hero Background Image', contentType: 'media', sample: '', description: 'Optional managed media used as the Hero background image.' } }
  hero.styles.desktop = { ...(hero.styles.desktop || {}), backgroundSize: 'cover', backgroundPosition: 'center' }

  const journeyCollection = createNode('collection', {
    props: { collection: 'experience', emptyText: 'Add experience entries from Admin.' },
    bindings: { items: { type: 'collection', collection: 'experience', sort: [{ field: 'display_order', direction: 'asc' }] } },
    styles: { desktop: { display: 'grid', gridTemplateColumns: '1fr', gap: '0', marginTop: '48px' } },
    children: [createNode('article', {
      meta: { label: 'Journey Chapter', sectionLabel: 'Journey Chapter' },
      scrollBehavior: { mode: 'stack-over-previous', stickyTop: 90, stackOrder: 20, mobileFallback: 'normal', reducedMotionFallback: 'reduce', activeStateKey: 'journey.active', activeStateValue: { source: 'context', key: 'collectionPosition' }, activeThreshold: .42 },
      styles: { desktop: { minHeight: 'min(68vh, 620px)', padding: '34px', borderRadius: '26px', border: '1px solid var(--site-border)', background: '#0d0d14', boxShadow: '0 -22px 70px rgba(0,0,0,.28)', display: 'grid', gridTemplateColumns: '190px 1fr', gap: '30px', marginBottom: '12vh' }, mobile: { minHeight: 'auto', gridTemplateColumns: '1fr', marginBottom: '24px' } },
      children: [
        createNode('div', { children: [
          createNode('p', { bindings: { text: { type: 'template', template: 'CHAPTER {{context:collectionPosition}} / {{context:collectionCount}}' } }, styles: { desktop: { color: 'var(--site-accent)', margin: '0 0 16px', letterSpacing: '.14em', fontSize: '11px' } } }),
          fieldNode('p', 'start_date', '2024', { color: 'var(--site-muted)', margin: 0 }),
        ] }),
        createNode('div', { children: [fieldNode('h3', 'role', 'Web Developer', { fontSize: '32px', margin: 0 }), fieldNode('p', 'company', 'Company', { color: 'var(--site-accent)', marginTop: '8px' }), fieldNode('p', 'summary', 'Experience summary', { color: 'var(--site-muted)', lineHeight: 1.7 })] }),
      ],
    })],
  })
  const journey = section('Journey', '#0b0b10', [contentNode('p', 'JOURNEY', 'home.journey.eyebrow', 'Journey Eyebrow', { color: 'var(--site-accent)', letterSpacing: '.18em', fontSize: '12px' }), contentNode('h2', 'Experience shaped by building.', 'home.journey.heading', 'Journey Heading', { fontSize: 'clamp(42px, 6vw, 76px)', letterSpacing: '-.05em', margin: '12px 0 0' }), journeyCollection], 2)

  const projectCollection = createNode('collection', {
    props: { collection: 'projects', emptyText: 'Add projects from Admin.' },
    bindings: { items: { type: 'collection', collection: 'projects', filters: [{ field: 'featured', operator: 'eq', value: true }], sort: [{ field: 'display_order', direction: 'asc' }], limit: 6 } },
    styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px', marginTop: '48px' }, tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, mobile: { gridTemplateColumns: '1fr' } },
    children: [createNode('article', {
      animation: { type: 'fade-up', trigger: 'scroll', duration: 700, easing: 'ease-out' },
      styles: { desktop: { padding: '24px', minHeight: '290px', borderRadius: '24px', border: '1px solid var(--site-border)', background: 'linear-gradient(160deg, rgba(124,58,237,.12), rgba(255,255,255,.02))', display: 'flex', flexDirection: 'column' } },
      children: [fieldNode('p', 'technologies', 'React • Node.js', { color: 'var(--site-accent)', fontSize: '12px' }), fieldNode('h3', 'title', 'Project Title', { fontSize: '30px', margin: 'auto 0 12px' }), fieldNode('p', 'short_description', 'Project description.', { color: 'var(--site-muted)', lineHeight: 1.6 }), createNode('a', { props: { text: 'View project →' }, bindings: { href: { type: 'field', field: 'slug' } }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none', marginTop: '18px' } } })],
    })],
  })
  const projects = section('Projects', '#090910', [contentNode('p', 'SELECTED WORK', 'home.projects.eyebrow', 'Projects Eyebrow', { color: 'var(--site-accent)', letterSpacing: '.18em', fontSize: '12px' }), contentNode('h2', 'Things I have built.', 'home.projects.heading', 'Projects Heading', { fontSize: 'clamp(42px, 6vw, 76px)', letterSpacing: '-.05em', margin: '12px 0 0' }), projectCollection], 3)

  const techActiveRule = (value: string): ConditionalStyleRule[] => [{ when: { left: { source: 'state' as const, key: 'tech.category' }, operator: 'eq' as const, right: { source: 'literal' as const, value } }, styles: { desktop: { background: 'var(--site-primary)', borderColor: 'var(--site-primary)', color: '#fff' } } }]
  const techCategoryButton = (label: string, value: string) => createNode('button', {
    props: { text: label, type: 'button' },
    interactions: [{ event: 'click', actions: [{ type: 'set-state', key: 'tech.category', value: { source: 'literal', value } }] }],
    conditionalStyles: techActiveRule(value),
    styles: { desktop: { padding: '10px 16px', borderRadius: '999px', border: '1px solid var(--site-border)', background: 'transparent', color: 'var(--site-muted)', cursor: 'pointer', fontWeight: 700 } },
  })
  const technologyCollection = createNode('collection', {
    meta: { label: 'Technology Installation Results', adminLabel: 'Technologies' },
    props: { collection: 'technologies', emptyText: 'Add published technologies from Admin → Collections.' },
    bindings: { items: { type: 'collection', collection: 'technologies', filters: [{ field: 'category', operator: 'eq', value: { source: 'state', key: 'tech.category' } }], sort: [{ field: 'display_order', direction: 'asc' }], countStateKey: 'tech.visibleCount' } },
    styles: { desktop: { display: 'grid', gap: '8px', marginTop: '18px' } },
    children: [createNode('div', {
      animation: { type: 'fade-up', trigger: 'load', duration: 380, easing: 'ease-out', stagger: 85, replayOnState: ['tech.category'] },
      styles: { desktop: { display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.06)' } },
      children: [
        createNode('span', { props: { text: '✓' }, styles: { desktop: { color: 'var(--site-accent)' } } }),
        createNode('code', { bindings: { text: { type: 'template', template: '{{field:name}}  {{field:install_command}}' } }, styles: { desktop: { color: 'var(--site-text)', whiteSpace: 'pre-wrap' } } }),
      ],
    })],
  })
  const tech = section('Tech Stack', '#0c0c12', [
    contentNode('p', 'TECH STACK', 'home.tech.eyebrow', 'Tech Eyebrow', { color: 'var(--site-accent)', letterSpacing: '.18em', fontSize: '12px' }),
    contentNode('h2', 'Tools I enjoy working with.', 'home.tech.heading', 'Tech Heading', { fontSize: 'clamp(42px, 6vw, 76px)', letterSpacing: '-.05em', margin: '12px 0 28px' }),
    createNode('div', { styles: { desktop: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '22px' } }, children: [techCategoryButton('Frontend','frontend'), techCategoryButton('Backend','backend')] }),
    createNode('div', {
      meta: { label: 'Installation Terminal', sectionLabel: 'Tech Stack Terminal' },
      styles: { desktop: { maxWidth: '940px', border: '1px solid var(--site-border)', borderRadius: '18px', overflow: 'hidden', background: '#07070b', boxShadow: '0 24px 70px rgba(0,0,0,.26)' } },
      children: [
        createNode('div', { styles: { desktop: { padding: '12px 16px', borderBottom: '1px solid var(--site-border)', color: 'var(--site-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px' } }, bindings: { text: { type: 'template', template: '$ install --category={{state:tech.category}}  ·  {{state:tech.visibleCount}} packages' } } }),
        createNode('div', { styles: { desktop: { padding: '18px 20px 22px' } }, children: [technologyCollection] }),
      ],
    }),
  ], 4)

  const about = section('About', '#08080c', [contentNode('p', 'ABOUT', 'home.about.eyebrow', 'About Eyebrow', { color: 'var(--site-accent)', letterSpacing: '.18em', fontSize: '12px' }), contentNode('h2', 'Developer, builder, learner.', 'home.about.heading', 'About Heading', { fontSize: 'clamp(42px, 6vw, 76px)', letterSpacing: '-.05em', maxWidth: '850px' }), contentNode('p', 'Use Admin Site Content to replace this with your real story.', 'home.about.body', 'About Body', { fontSize: '20px', lineHeight: 1.8, color: 'var(--site-muted)', maxWidth: '760px' })], 5)

  const cta = section('Contact CTA', 'radial-gradient(circle at 50% 30%, rgba(34,211,238,.13), transparent 30%), #07070a', [contentNode('p', 'LET’S BUILD', 'home.cta.eyebrow', 'CTA Eyebrow', { color: 'var(--site-accent)', letterSpacing: '.18em', fontSize: '12px', textAlign: 'center' }), contentNode('h2', 'Start a conversation.', 'home.cta.heading', 'CTA Heading', { fontSize: 'clamp(52px, 8vw, 104px)', letterSpacing: '-.06em', textAlign: 'center', margin: '20px auto', maxWidth: '1000px' }), contentNode('p', 'Tell me what you are building.', 'home.cta.description', 'CTA Description', { color: 'var(--site-muted)', textAlign: 'center', fontSize: '20px' }), createNode('a', { props: { text: 'Connect with me', href: '/contact' }, bindings: { text: { type: 'content', key: 'home.cta.button_label', label: 'CTA Button Label', contentType: 'text', sample: 'Connect with me' }, href: { type: 'content', key: 'home.cta.button_url', label: 'CTA Button URL', contentType: 'url', sample: '/contact' } }, styles: { desktop: { display: 'block', width: 'fit-content', margin: '34px auto 0', padding: '15px 24px', borderRadius: '999px', background: 'var(--site-primary)', color: '#fff', textDecoration: 'none', fontWeight: 700 } } })], 6)

  page.schema.root = [hero, journey, projects, tech, about, cta]
  return page
}

function collectionPage(name: string, slug: string, collection: CollectionName, headingKey: string): EditorPage {
  const page = createEmptyPage(name, 'collection_index')
  page.slug = slug; page.routePattern = `/${slug}`
  page.schema.collectionName = collection
  page.seoDefaults = { title: name, description: `${name} from the portfolio.` }
  const titleField = collection === 'apps' ? 'name' : 'title'
  const summaryField = collection === 'experience' ? 'summary' : collection === 'apps' ? 'short_description' : collection === 'notes' ? 'summary' : 'short_description'
  page.schema.root = [createNode('main', {
    styles: { desktop: { minHeight: '80vh', padding: '88px 6vw', background: 'var(--site-bg)', color: 'var(--site-text)' } },
    children: [
      contentNode('h1', name, headingKey, `${name} Heading`, { fontSize: 'clamp(52px, 8vw, 104px)', letterSpacing: '-.06em', margin: '0 0 54px' }),
      createNode('collection', {
        bindings: { items: { type: 'collection', collection, sort: [{ field: 'display_order', direction: 'asc' }] } },
        props: { collection },
        styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px' }, tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, mobile: { gridTemplateColumns: '1fr' } },
        children: [createNode('article', { styles: { desktop: { minHeight: '240px', padding: '24px', border: '1px solid var(--site-border)', borderRadius: '22px', background: 'var(--site-surface)' } }, children: [fieldNode('h2', titleField, `${name} Item`, { fontSize: '26px' }), fieldNode('p', summaryField, 'Description', { color: 'var(--site-muted)', lineHeight: 1.6 }), collection === 'apps' ? fieldNode('p', 'status', 'coming_soon', { color: 'var(--site-accent)' }) : createNode('a', { props: { text: 'Open →' }, bindings: { href: { type: 'field', field: 'slug' } }, styles: { desktop: { color: 'var(--site-text)' } } })] })],
      }),
    ],
  })]
  return page
}

function detailPage(name: string, slug: string, collection: 'projects' | 'notes', singular: 'project' | 'note'): EditorPage {
  const page = createEmptyPage(name, 'collection_detail')
  page.slug = slug; page.routePattern = `/${collection}/:slug`; page.schema.collectionName = collection
  const bodyField = singular === 'project' ? 'full_description' : 'content'
  page.schema.root = [createNode('main', { styles: { desktop: { minHeight: '80vh', padding: '88px 6vw', background: 'var(--site-bg)', color: 'var(--site-text)' } }, children: [
    fieldNode('p', singular === 'project' ? 'technologies' : 'category', singular === 'project' ? 'React • TypeScript' : 'Notes', { color: 'var(--site-accent)' }),
    fieldNode('h1', 'title', `${name} Title`, { fontSize: 'clamp(48px, 7vw, 96px)', letterSpacing: '-.055em', maxWidth: '1000px' }),
    fieldNode('p', singular === 'project' ? 'short_description' : 'summary', 'Summary', { fontSize: '22px', color: 'var(--site-muted)', lineHeight: 1.7, maxWidth: '820px' }),
    fieldNode('article', bodyField, 'Detailed content', { marginTop: '52px', color: 'var(--site-text)', lineHeight: 1.85, maxWidth: '900px', whiteSpace: 'pre-wrap' }),
  ] })]
  return page
}

function simplePage(name: string, bodyKey: string): EditorPage {
  const page = createEmptyPage(name, 'standard')
  page.slug = slugify(name); page.routePattern = `/${page.slug}`
  page.schema.root = [createNode('main', { meta: { sectionLabel: name }, styles: { desktop: { minHeight: '80vh', padding: '96px 6vw', background: 'var(--site-bg)', color: 'var(--site-text)' } }, children: [
    contentNode('p', name.toUpperCase(), `${bodyKey}.eyebrow`, `${name} Eyebrow`, { color: 'var(--site-accent)', letterSpacing: '.18em', fontSize: '12px' }),
    contentNode('h1', name, `${bodyKey}.heading`, `${name} Heading`, { fontSize: 'clamp(54px, 8vw, 104px)', letterSpacing: '-.06em', margin: '14px 0 28px' }, true),
    contentNode('p', `Edit the ${name} content from Admin.`, `${bodyKey}.body`, `${name} Body`, { fontSize: '21px', lineHeight: 1.8, color: 'var(--site-muted)', maxWidth: '840px' }),
  ] })]
  return page
}

export function createCosmicPortfolioTemplate(): EditorDocument {
  const pages = [
    createHeaderPage(),
    createHomePage(),
    collectionPage('Projects', 'projects', 'projects', 'projects.heading'),
    detailPage('Project Detail', 'project-detail', 'projects', 'project'),
    collectionPage('Notes', 'notes', 'notes', 'notes.heading'),
    detailPage('Note Detail', 'note-detail', 'notes', 'note'),
    collectionPage('Apps', 'apps', 'apps', 'apps.heading'),
    simplePage('About', 'about'),
    simplePage('Contact', 'contact'),
    createFooterPage(),
  ]
  pages.forEach((page, index) => { if (page.pageType !== 'system') page.sortOrder = index })
  return {
    layoutId: null,
    layoutName: 'Cosmic Portfolio',
    layoutSlug: 'cosmic-portfolio',
    layoutDescription: 'Cinematic cosmic portfolio with reusable stacked sections, collections and editable content slots.',
    versionId: null,
    versionNumber: 1,
    versionStatus: 'draft',
    designTokens: {
      ...DEFAULT_DESIGN_TOKENS,
      variables: {
        '--site-bg': '#07070a', '--site-surface': '#101016', '--site-surface-2': '#171720', '--site-text': '#f8fafc', '--site-muted': '#9aa3b4', '--site-border': '#2a2a34', '--site-primary': '#7c3aed', '--site-accent': '#22d3ee',
      },
      fonts: { heading: 'Inter, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif' },
      breakpoints: { desktop: 1440, tablet: 768, mobile: 375 },
    },
    pages,
  }
}

export function createTemplateByName(template: 'blank' | 'cosmic', name?: string): EditorDocument {
  if (template === 'cosmic') return createCosmicPortfolioTemplate()
  return createBlankDocument(name || 'Untitled Layout')
}

export function ensureSchemaVersion(document: EditorDocument): EditorDocument {
  return {
    ...document,
    pages: document.pages.map((page) => ({ ...page, schema: { ...page.schema, schemaVersion: LAYOUT_SCHEMA_VERSION, pageId: page.id } })),
  }
}
