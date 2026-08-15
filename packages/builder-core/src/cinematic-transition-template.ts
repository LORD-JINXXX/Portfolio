import { DEFAULT_DESIGN_TOKENS, type CollectionName, type ConditionalStyleRule, type EditorDocument, type EditorPage, type StudioNode } from '@platform/contracts'
import { createEmptyPage, createNode, slugify } from './editor-state'

type StyleValue = string | number | boolean | null | undefined
type Styles = Record<string, StyleValue>

function contentNode(type: any, text: string, key: string, label: string, styles: Styles = {}, required = false): StudioNode {
  return createNode(type, {
    props: { text },
    bindings: { text: { type: 'content', key, label, contentType: 'text', sample: text, required } },
    styles: { desktop: styles },
    meta: { label, adminLabel: label },
  })
}

function fieldNode(type: any, field: string, fallback: string, styles: Styles = {}): StudioNode {
  return createNode(type, {
    props: { text: fallback },
    bindings: { text: { type: 'field', field, fallback } },
    styles: { desktop: styles },
    meta: { label: field },
  })
}

function editableLink(label: string, labelKey: string, href: string, hrefKey: string, inverse = false): StudioNode {
  return createNode('a', {
    props: { text: label, href },
    bindings: {
      text: { type: 'content', key: labelKey, label: `${label} Label`, contentType: 'text', sample: label },
      href: { type: 'content', key: hrefKey, label: `${label} URL`, contentType: 'url', sample: href },
    },
    animation: { type: 'lift-hover', trigger: 'hover', duration: 200, easing: 'ease-out' },
    styles: { desktop: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '50px', padding: '0 24px', border: '2px solid currentColor', borderRadius: '999px', background: inverse ? 'currentColor' : 'transparent', color: inverse ? 'var(--scene-ink)' : 'inherit', textDecoration: 'none', fontWeight: 850, fontSize: '13px' } },
  })
}

interface SceneOptions {
  enterFrom: 'top' | 'right' | 'bottom' | 'left' | 'none'
  exitTo: 'top' | 'right' | 'bottom' | 'left' | 'none'
  skipEntry?: boolean
  finalScene?: boolean
}

function sceneFrame(title: string, panel: StudioNode, options: SceneOptions): StudioNode {
  panel.styles = {
    ...panel.styles,
    desktop: { ...(panel.styles.desktop || {}), width: '100%', height: 'auto', minHeight: '100dvh', overflow: 'visible' },
    tablet: { ...(panel.styles.tablet || {}), minHeight: '100dvh' },
    mobile: { ...(panel.styles.mobile || {}), height: 'auto', minHeight: 'auto', overflow: 'hidden' },
  }
  return createNode('scene-frame', {
    meta: { label: `${title} Scene Frame`, sectionLabel: title, adminLabel: title },
    props: {
      enterFrom: options.enterFrom, exitTo: options.exitTo,
      skipEntry: Boolean(options.skipEntry), finalScene: Boolean(options.finalScene),
    },
    styles: { desktop: { position: 'relative', width: '100%', minHeight: '100dvh', overflow: 'visible' }, mobile: { minHeight: 'auto', overflow: 'visible' } },
    children: [panel],
  })
}

function headingGroup(key: string, eyebrow: string, heading: string, description: string, ink = 'inherit'): StudioNode {
  return createNode('div', {
    styles: { desktop: { position: 'relative', zIndex: 3, maxWidth: '980px' } },
    children: [
      contentNode('p', eyebrow, `${key}.eyebrow`, `${eyebrow} Eyebrow`, { margin: 0, color: ink, opacity: .62, fontSize: '11px', fontWeight: 850, letterSpacing: '.24em' }),
      contentNode('h2', heading, `${key}.heading`, `${eyebrow} Heading`, { margin: '18px 0 0', color: ink, fontSize: 'clamp(54px,8.5vw,132px)', lineHeight: '.82', fontWeight: 950, letterSpacing: '-.075em' }, true),
      contentNode('p', description, `${key}.description`, `${eyebrow} Description`, { maxWidth: '720px', margin: '30px 0 0', color: ink, opacity: .7, fontSize: 'clamp(16px,1.5vw,20px)', lineHeight: 1.65 }),
    ],
  })
}

function heroPanel(): StudioNode {
  return createNode('section', {
    meta: { label: 'Hero Scene', sectionLabel: 'Hero', adminLabel: 'Hero' },
    bindings: { 'style.backgroundImage': { type: 'content', key: 'home.hero.backgroundImage', label: 'Hero Background Image', contentType: 'media', sample: '' } },
    styles: {
      desktop: { position: 'relative', padding: 'clamp(92px,10vh,132px) 5vw 46px', background: '#f2efe8', backgroundSize: 'cover', backgroundPosition: 'center', color: '#111111', '--scene-ink': '#f2efe8' },
      tablet: { padding: '100px 36px 42px' }, mobile: { padding: '84px 20px 48px' },
    },
    children: [
      createNode('div', { styles: { desktop: { position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .28, backgroundImage: 'linear-gradient(rgba(0,0,0,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.12) 1px,transparent 1px)', backgroundSize: '64px 64px', maskImage: 'linear-gradient(to bottom,#000,transparent 88%)' } } }),
      createNode('div', { styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1400px,100%)', height: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }, children: [
        createNode('div', { children: [
          contentNode('p', 'FULL-STACK ENGINEER · CREATIVE DEVELOPER', 'home.hero.eyebrow', 'Hero Eyebrow', { margin: 0, fontSize: '11px', fontWeight: 900, letterSpacing: '.2em' }),
          contentNode('h1', 'MUSTAFA BUILDS THE UNEXPECTED.', 'home.hero.heading', 'Hero Heading', { maxWidth: '1320px', margin: '24px 0 0', fontSize: 'clamp(66px,10.7vw,164px)', lineHeight: '.78', fontWeight: 950, letterSpacing: '-.083em' }, true),
          contentNode('p', 'Interfaces with rhythm. Systems with clarity. Products built to move.', 'home.hero.description', 'Hero Description', { maxWidth: '650px', margin: '34px 0 0 auto', fontSize: 'clamp(17px,1.5vw,21px)', lineHeight: 1.55, textAlign: 'right' }, true),
        ], animation: { type: 'fade-up', trigger: 'load', duration: 800, easing: 'ease-out' } }),
        createNode('div', { styles: { desktop: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '24px', flexWrap: 'wrap' } }, children: [
          createNode('div', { styles: { desktop: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, children: [editableLink('See selected work', 'home.hero.primaryCtaLabel', '/projects', 'home.hero.primaryCtaUrl'), editableLink('Start a project', 'home.hero.secondaryCtaLabel', '/contact', 'home.hero.secondaryCtaUrl')] }),
          contentNode('p', 'SCROLL TO DIRECT THE FILM ↓', 'home.hero.scrollCue', 'Hero Scroll Cue', { margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10px', letterSpacing: '.14em' }),
        ] }),
      ] }),
    ],
  })
}

function categoryRules(): ConditionalStyleRule[] {
  return [
    { when: { left: { source: 'state', key: 'tech.category', fallback: 'frontend' }, operator: 'eq', right: { source: 'field', key: 'category_key' } }, styles: { desktop: { color: '#111111', opacity: 1, background: '#dfff00', borderColor: '#dfff00', transform: 'translateX(8px)' }, mobile: { transform: 'none' } } },
    { when: { left: { source: 'state', key: 'tech.category', fallback: 'frontend' }, operator: 'neq', right: { source: 'field', key: 'category_key' } }, styles: { desktop: { color: 'rgba(255,255,255,.58)', opacity: .78, background: 'transparent', borderColor: 'rgba(255,255,255,.2)', transform: 'translateX(0)' } } },
  ]
}

function techPanel(): StudioNode {
  const categories = createNode('collection', {
    meta: { label: 'Technology Categories', adminLabel: 'Technology Categories' },
    props: { collection: 'technology_categories', emptyText: 'Add published Technology Categories in Admin.' },
    bindings: { items: { type: 'collection', collection: 'technology_categories', sort: [{ field: 'display_order', direction: 'asc' }] } },
    styles: { desktop: { display: 'flex', flexDirection: 'column', gap: '8px' }, mobile: { flexDirection: 'row', flexWrap: 'wrap', gap: '8px' } },
    children: [createNode('button', {
      meta: { label: 'Technology Category Button' }, props: { text: '01 FRONTEND', type: 'button' },
      bindings: { text: { type: 'field', field: 'label', fallback: '01 FRONTEND' } },
      interactions: [{ event: 'click', actions: [{ type: 'set-state', key: 'tech.category', value: { source: 'field', key: 'category_key', fallback: 'frontend' } }] }],
      conditionalStyles: categoryRules(),
      styles: { desktop: { width: '100%', minHeight: '48px', padding: '0 16px', border: '1px solid rgba(255,255,255,.2)', borderRadius: '6px', background: 'transparent', color: 'rgba(255,255,255,.58)', textAlign: 'left', cursor: 'pointer', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 800, transition: 'all 180ms ease' }, mobile: { width: 'auto', minHeight: '42px', padding: '0 13px', borderRadius: '999px', fontSize: '10px', textAlign: 'center' } },
    })],
  })
  const technologies = createNode('collection', {
    meta: { label: 'Filtered Technologies', adminLabel: 'Technologies' }, props: { collection: 'technologies', emptyText: 'Add technologies that match the selected category.' },
    bindings: { items: { type: 'collection', collection: 'technologies', filters: [{ field: 'category', operator: 'eq', value: { source: 'state', key: 'tech.category', fallback: 'frontend' } }], sort: [{ field: 'display_order', direction: 'asc' }], countStateKey: 'tech.visibleCount' } },
    styles: { desktop: { display: 'grid', gap: '0', marginTop: '22px' } },
    children: [createNode('div', {
      animation: { type: 'fade-up', trigger: 'scroll', duration: 380, stagger: 70, repeat: true, easing: 'ease-out', replayOnState: ['tech.category'] },
      styles: { desktop: { minHeight: '42px', display: 'grid', gridTemplateColumns: '28px minmax(120px,.8fr) minmax(150px,1fr)', gap: '10px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.1)' }, mobile: { gridTemplateColumns: '24px 1fr' } },
      children: [createNode('span', { props: { text: '↳' }, styles: { desktop: { color: '#dfff00' } } }), fieldNode('code', 'name', 'Technology', { color: '#ffffff', fontSize: '12px' }), fieldNode('code', 'install_command', 'install command', { color: 'rgba(255,255,255,.48)', fontSize: '10px', textAlign: 'right' })],
    })],
  })
  return createNode('section', {
    meta: { label: 'Tech Stack Scene', sectionLabel: 'Tech Stack', adminLabel: 'Tech Stack' },
    styles: { desktop: { position: 'relative', padding: 'clamp(84px,9vh,120px) 5vw 44px', background: '#111111', color: '#ffffff', '--scene-ink': '#111111' }, tablet: { padding: '90px 36px 40px' }, mobile: { padding: '76px 20px 52px' } },
    children: [createNode('div', { styles: { desktop: { width: 'min(1380px,100%)', height: '100%', margin: '0 auto', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '38px' } }, children: [
      headingGroup('home.techStack', '02 / TECH STACK', 'TOOLS WITH A POINT OF VIEW.', 'The categories and technologies below are collection-driven. Add, remove or reorder them in Admin—Studio rebuilds nothing.', '#ffffff'),
      createNode('div', { styles: { desktop: { display: 'grid', gridTemplateColumns: '250px minmax(0,1fr)', gap: '24px', minHeight: 0 }, tablet: { gridTemplateColumns: '210px minmax(0,1fr)' }, mobile: { gridTemplateColumns: '1fr' } }, children: [categories, createNode('div', { styles: { desktop: { alignSelf: 'stretch', padding: '24px 28px', overflow: 'auto', border: '1px solid rgba(255,255,255,.18)', borderRadius: '16px', background: '#080808', boxShadow: '0 26px 90px rgba(0,0,0,.42)' }, mobile: { padding: '20px' } }, children: [
        createNode('div', { styles: { desktop: { display: 'flex', gap: '7px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,.14)' } }, children: [createNode('span', { props: { text: '● ● ●' }, styles: { desktop: { color: '#777777', letterSpacing: '.22em', fontSize: '10px' } } }), createNode('code', { bindings: { text: { type: 'template', template: '{{state:tech.category}}.stack' } }, styles: { desktop: { marginLeft: 'auto', color: 'rgba(255,255,255,.45)', fontSize: '10px' } } })] }),
        createNode('code', { bindings: { text: { type: 'template', template: '$ npx portfolio-stack {{state:tech.category}}' } }, animation: { type: 'typewriter', trigger: 'load', duration: 800, easing: 'linear', replayOnState: ['tech.category'] }, styles: { desktop: { display: 'block', marginTop: '24px', color: '#dfff00', fontSize: '12px' } } }),
        technologies,
        createNode('code', { bindings: { text: { type: 'template', template: '✓ {{state:tech.visibleCount}} tools ready.' } }, animation: { type: 'typewriter', trigger: 'load', duration: 650, delay: 220, easing: 'linear', replayOnState: ['tech.category'] }, styles: { desktop: { display: 'block', marginTop: '24px', color: '#a8f5b4', fontSize: '11px' } } }),
      ] })] }),
    ] })],
  })
}

function journeyPanel(): StudioNode {
  const chapters = createNode('collection', {
    meta: { label: 'Journey Chapters', adminLabel: 'Experience' }, props: { collection: 'experience', emptyText: 'Add experience entries in Admin.' },
    bindings: { items: { type: 'collection', collection: 'experience', sort: [{ field: 'display_order', direction: 'asc' }], limit: 7 } },
    styles: { desktop: { display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '10px', scrollSnapType: 'x mandatory' } },
    children: [createNode('article', {
      styles: { desktop: { flex: '0 0 min(430px,78vw)', minHeight: '300px', padding: '28px', display: 'flex', flexDirection: 'column', border: '2px solid #22170f', borderRadius: '0', background: 'rgba(255,255,255,.12)', scrollSnapAlign: 'start' } },
      animation: { type: 'fade-right', trigger: 'scroll', duration: 560, stagger: 90, easing: 'ease-out', repeat: true },
      children: [createNode('p', { bindings: { text: { type: 'template', template: 'CHAPTER {{context:collectionPosition}} / {{context:collectionCount}}' } }, styles: { desktop: { margin: 0, fontFamily: 'monospace', fontSize: '10px', letterSpacing: '.14em' } } }), fieldNode('h3', 'role', 'Product Engineer', { margin: 'auto 0 0', fontSize: 'clamp(30px,4vw,48px)', lineHeight: .92, letterSpacing: '-.045em' }), fieldNode('p', 'company', 'Company', { margin: '12px 0 0', fontWeight: 850 }), fieldNode('p', 'summary', 'Experience summary', { margin: '14px 0 0', opacity: .72, lineHeight: 1.55 })],
    })],
  })
  return createNode('section', {
    meta: { label: 'Journey Scene', sectionLabel: 'Journey', adminLabel: 'Journey' },
    styles: { desktop: { position: 'relative', padding: 'clamp(84px,9vh,120px) 5vw 44px', background: '#f07a4f', color: '#22170f', '--scene-ink': '#f07a4f' }, tablet: { padding: '90px 36px 40px' }, mobile: { padding: '76px 20px 52px' } },
    children: [createNode('div', { styles: { desktop: { width: 'min(1380px,100%)', height: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '40px' } }, children: [headingGroup('home.journey', '03 / JOURNEY', 'THE WORK LEFT A TRACE.', 'A collection-driven timeline of roles, lessons and the moments that changed how I build.'), chapters] })],
  })
}

function projectsPanel(): StudioNode {
  const projects = createNode('collection', {
    meta: { label: 'Selected Projects', adminLabel: 'Projects' }, props: { collection: 'projects', emptyText: 'Add published projects in Admin.' },
    bindings: { items: { type: 'collection', collection: 'projects', filters: [{ field: 'featured', operator: 'eq', value: true }], sort: [{ field: 'display_order', direction: 'asc' }], limit: 4 } },
    styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px' }, mobile: { gridTemplateColumns: '1fr' } },
    children: [createNode('article', {
      animation: { type: 'reveal', trigger: 'scroll', duration: 620, stagger: 110, easing: 'ease-out', repeat: true },
      styles: { desktop: { minHeight: '230px', padding: '24px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,.28)', background: 'rgba(0,0,0,.14)' } },
      children: [fieldNode('p', 'technologies', 'REACT · NODE', { margin: 0, color: '#d9ff66', fontSize: '10px', letterSpacing: '.14em' }), fieldNode('h3', 'title', 'Project title', { margin: 'auto 0 0', fontSize: 'clamp(30px,4vw,52px)', lineHeight: .9, letterSpacing: '-.05em' }), fieldNode('p', 'short_description', 'Project summary', { margin: '14px 0 0', color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }), createNode('a', { props: { text: 'OPEN CASE STUDY ↗' }, bindings: { href: { type: 'field', field: 'slug' } }, styles: { desktop: { marginTop: '18px', color: '#ffffff', fontSize: '10px', fontWeight: 850, letterSpacing: '.12em', textDecoration: 'none' } } })],
    })],
  })
  return createNode('section', {
    meta: { label: 'Projects Scene', sectionLabel: 'Projects', adminLabel: 'Projects' },
    styles: { desktop: { position: 'relative', padding: 'clamp(84px,9vh,120px) 5vw 42px', background: '#3157ff', color: '#ffffff', '--scene-ink': '#3157ff' }, tablet: { padding: '90px 36px 40px' }, mobile: { padding: '76px 20px 52px' } },
    children: [createNode('div', { styles: { desktop: { width: 'min(1380px,100%)', height: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '.8fr 1.2fr', gap: '50px', alignItems: 'end' }, tablet: { gridTemplateColumns: '1fr', alignItems: 'start' } }, children: [headingGroup('home.projects', '04 / PROJECTS', 'PROOF, NOT PROMISES.', 'Selected collection-backed work. Publish a project in Admin and it enters the film automatically.', '#ffffff'), projects] })],
  })
}

function notesPanel(): StudioNode {
  const notes = createNode('collection', {
    meta: { label: 'Latest Notes', adminLabel: 'Notes' }, props: { collection: 'notes', emptyText: 'Publish notes from Admin.' },
    bindings: { items: { type: 'collection', collection: 'notes', sort: [{ field: 'display_order', direction: 'asc' }], limit: 4 } },
    styles: { desktop: { display: 'grid', borderTop: '2px solid #17150f' } },
    children: [createNode('a', {
      props: { href: '#' }, bindings: { href: { type: 'field', field: 'slug' } }, animation: { type: 'lift-hover', trigger: 'hover', duration: 200, easing: 'ease-out' },
      styles: { desktop: { minHeight: '90px', padding: '18px 0', display: 'grid', gridTemplateColumns: '58px minmax(0,1fr) auto', gap: '16px', alignItems: 'center', borderBottom: '1px solid rgba(23,21,15,.3)', color: '#17150f', textDecoration: 'none' }, mobile: { gridTemplateColumns: '42px minmax(0,1fr)' } },
      children: [createNode('span', { bindings: { text: { type: 'template', template: '{{context:collectionPosition}}' } }, styles: { desktop: { fontFamily: 'monospace', fontSize: '11px' } } }), createNode('div', { children: [fieldNode('h3', 'title', 'Note title', { margin: 0, fontSize: 'clamp(22px,3vw,36px)', letterSpacing: '-.035em' }), fieldNode('p', 'summary', 'Note summary', { margin: '5px 0 0', opacity: .62 })] }), createNode('span', { props: { text: 'READ ↗' }, styles: { desktop: { fontSize: '10px', fontWeight: 900, letterSpacing: '.12em' }, mobile: { display: 'none' } } })],
    })],
  })
  return createNode('section', {
    meta: { label: 'Notes Scene', sectionLabel: 'Notes', adminLabel: 'Notes' },
    styles: { desktop: { position: 'relative', padding: 'clamp(84px,9vh,120px) 5vw 42px', background: '#e7dfcb', color: '#17150f', '--scene-ink': '#e7dfcb' }, tablet: { padding: '90px 36px 40px' }, mobile: { padding: '76px 20px 52px' } },
    children: [createNode('div', { styles: { desktop: { width: 'min(1380px,100%)', height: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '.92fr 1.08fr', gap: '60px', alignItems: 'center' }, tablet: { gridTemplateColumns: '1fr' } }, children: [headingGroup('home.notes', '05 / FIELD NOTES', 'IDEAS, LEFT OPEN.', 'Short notes about engineering, interface craft, AI and the work between disciplines.'), notes] })],
  })
}

function finalePanel(): StudioNode {
  return createNode('footer', {
    meta: { label: 'Final Footer Scene', sectionLabel: 'Finale', adminLabel: 'Final Footer' },
    styles: { desktop: { position: 'relative', padding: 'clamp(84px,10vh,128px) 5vw 46px', background: '#dfff00', color: '#101010', '--scene-ink': '#dfff00' }, tablet: { padding: '90px 36px 40px' }, mobile: { padding: '76px 20px 42px' } },
    children: [createNode('div', { styles: { desktop: { width: 'min(1380px,100%)', height: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '50px' } }, children: [
      createNode('div', { children: [contentNode('p', '06 / FINALE', 'home.finale.eyebrow', 'Finale Eyebrow', { margin: 0, fontSize: '11px', fontWeight: 900, letterSpacing: '.22em' }), contentNode('h2', 'LET’S MAKE THE NEXT FRAME MATTER.', 'home.finale.heading', 'Finale Heading', { maxWidth: '1280px', margin: '24px 0 0', fontSize: 'clamp(64px,11vw,172px)', lineHeight: '.78', fontWeight: 950, letterSpacing: '-.083em' }, true), contentNode('p', 'Have a product, platform or impossible-looking idea? I would like to hear it.', 'home.finale.description', 'Finale Description', { maxWidth: '680px', margin: '34px 0 0 auto', fontSize: 'clamp(17px,1.6vw,22px)', lineHeight: 1.55, textAlign: 'right' })] }),
      createNode('div', { styles: { desktop: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '24px', flexWrap: 'wrap', paddingTop: '26px', borderTop: '2px solid #101010' } }, children: [editableLink('Start a conversation', 'home.finale.ctaLabel', '/contact', 'home.finale.ctaUrl'), contentNode('p', 'DESIGNED AND BUILT BY MUSTAFA', 'home.finale.credit', 'Finale Credit', { margin: 0, fontFamily: 'monospace', fontSize: '10px', letterSpacing: '.14em' })] }),
    ] })],
  })
}

function createCinematicHeaderPage(): EditorPage {
  const page = createEmptyPage('Header', 'system')
  page.slug = '_header'; page.routePattern = '__header'; page.sortOrder = -100
  page.schema.root = [createNode('header', {
    meta: { label: 'Cinematic Header', sectionLabel: 'Header', adminLabel: 'Header' },
    styles: { desktop: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, minHeight: '62px', padding: '0 4vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ffffff', mixBlendMode: 'difference', pointerEvents: 'none' }, mobile: { padding: '0 18px' } },
    children: [contentNode('span', 'M / 26', 'site.brand.mark', 'Brand Mark', { fontWeight: 950, letterSpacing: '-.03em', pointerEvents: 'auto' }), createNode('nav', { styles: { desktop: { display: 'flex', gap: '18px', pointerEvents: 'auto' }, mobile: { gap: '10px', fontSize: '11px' } }, children: [createNode('a', { props: { text: 'WORK', href: '/projects' }, styles: { desktop: { color: 'inherit', textDecoration: 'none', fontSize: '11px', fontWeight: 850 } } }), createNode('a', { props: { text: 'NOTES', href: '/notes' }, styles: { desktop: { color: 'inherit', textDecoration: 'none', fontSize: '11px', fontWeight: 850 } } }), createNode('a', { props: { text: 'CONTACT', href: '/contact' }, styles: { desktop: { color: 'inherit', textDecoration: 'none', fontSize: '11px', fontWeight: 850 } } })] })],
  })]
  return page
}

function createCinematicFooterPage(): EditorPage {
  const page = createEmptyPage('Footer', 'system')
  page.slug = '_footer'; page.routePattern = '__footer'; page.sortOrder = 10000
  page.schema.root = [createNode('footer', { meta: { label: 'Legal Footer', sectionLabel: 'Footer', adminLabel: 'Footer' }, styles: { desktop: { minHeight: '54px', padding: '16px 5vw', display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', background: '#101010', color: 'rgba(255,255,255,.58)', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '.1em' } }, children: [contentNode('span', '© 2026 MUSTAFA', 'footer.copyright', 'Footer Copyright'), contentNode('span', 'BUILT WITH THE DYNAMIC PORTFOLIO PLATFORM', 'footer.platform', 'Footer Platform Credit')] })]
  return page
}

function createHomePage(): EditorPage {
  const page = createEmptyPage('Home', 'home')
  page.schema.initialState = { 'tech.category': 'frontend', 'tech.visibleCount': 0, 'journey.activeIndex': 1 }
  page.seoDefaults = { title: 'Mustafa — Cinematic Portfolio', description: 'A scroll-directed portfolio about products, systems and craft.' }
  const intro = createNode('intro-sequence', {
    meta: { label: 'Opening Film and Loader', sectionLabel: 'Intro', adminLabel: 'Opening Sequence' },
    props: { nameText: 'MUSTAFA', loadingText: 'LOADING PORTFOLIO', upcomingEyebrow: 'COMING UP NEXT', upcomingTitle: '', directionNeutralBridge: true, src: '', poster: '', duration: 2800, bridgeDuration: 520, exitDuration: 760, exitDirection: 'right' },
    bindings: {
      nameText: { type: 'content', key: 'home.intro.name', label: 'Intro Name', contentType: 'text', sample: 'MUSTAFA' },
      loadingText: { type: 'content', key: 'home.intro.loadingLabel', label: 'Loading Label', contentType: 'text', sample: 'LOADING PORTFOLIO' },
      upcomingEyebrow: { type: 'content', key: 'home.intro.upcomingText', label: 'Intro Coming Up Text', contentType: 'text', sample: 'COMING UP NEXT' },
      src: { type: 'content', key: 'home.intro.video', label: 'Intro Background Video', contentType: 'media', sample: '' },
      poster: { type: 'content', key: 'home.intro.poster', label: 'Intro Video Poster', contentType: 'media', sample: '' },
    },
  })
  const sequence = createNode('cinematic-sequence', {
    meta: { label: 'Cinematic Section Stack', sectionLabel: 'Cinematic Sequence', adminLabel: 'Cinematic Sequence' },
    props: { bridgeText: 'COMING UP NEXT', entryDistanceVh: 86, exitDistanceVh: 86, topHoldVh: 30, bottomHoldVh: 34, bridgeHoldVh: 30 },
    bindings: { bridgeText: { type: 'content', key: 'home.transitions.bridgeText', label: 'Transition Bridge Text', contentType: 'text', sample: 'COMING UP NEXT' } },
    styles: { desktop: { position: 'relative', background: '#050505', overflow: 'clip' }, mobile: { minHeight: 'auto', overflow: 'visible' } },
    children: [
      sceneFrame('Hero', heroPanel(), { enterFrom: 'left', exitTo: 'top', skipEntry: true }),
      sceneFrame('Tech Stack', techPanel(), { enterFrom: 'top', exitTo: 'right' }),
      sceneFrame('Journey', journeyPanel(), { enterFrom: 'right', exitTo: 'bottom' }),
      sceneFrame('Projects', projectsPanel(), { enterFrom: 'bottom', exitTo: 'left' }),
      sceneFrame('Field Notes', notesPanel(), { enterFrom: 'left', exitTo: 'top' }),
      sceneFrame('Finale', finalePanel(), { enterFrom: 'bottom', exitTo: 'none', finalScene: true }),
    ],
  })
  page.schema.root = [
    intro,
    sequence,
  ]
  return page
}

function collectionIndexPage(name: string, slug: string, collection: CollectionName, titleField: string, summaryField: string): EditorPage {
  const page = createEmptyPage(name, 'collection_index')
  page.slug = slug; page.routePattern = `/${slug}`; page.schema.collectionName = collection
  page.seoDefaults = { title: name, description: `${name} from Mustafa.` }
  page.schema.root = [createNode('main', { styles: { desktop: { minHeight: '100vh', padding: '120px 5vw 80px', background: '#111111', color: '#ffffff' }, mobile: { padding: '90px 20px 64px' } }, children: [
    contentNode('p', `ALL ${name.toUpperCase()}`, `${slug}.eyebrow`, `${name} Eyebrow`, { margin: 0, color: '#dfff00', fontSize: '11px', fontWeight: 850, letterSpacing: '.2em' }),
    contentNode('h1', name, `${slug}.heading`, `${name} Heading`, { margin: '20px 0 58px', fontSize: 'clamp(64px,11vw,160px)', lineHeight: .8, letterSpacing: '-.08em' }, true),
    createNode('collection', { props: { collection, emptyText: `Add ${name.toLowerCase()} in Admin.` }, bindings: { items: { type: 'collection', collection, sort: [{ field: 'display_order', direction: 'asc' }] } }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px' }, mobile: { gridTemplateColumns: '1fr' } }, children: [createNode('article', { styles: { desktop: { minHeight: '260px', padding: '26px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,.2)' } }, children: [fieldNode('h2', titleField, `${name} item`, { margin: 'auto 0 0', fontSize: '42px', lineHeight: .92, letterSpacing: '-.05em' }), fieldNode('p', summaryField, 'Summary', { color: 'rgba(255,255,255,.62)', lineHeight: 1.6 }), createNode('a', { props: { text: 'OPEN ↗' }, bindings: { href: { type: 'field', field: 'slug' } }, styles: { desktop: { color: '#dfff00', textDecoration: 'none', fontSize: '11px', fontWeight: 850 } } })] })] }),
  ] })]
  return page
}

function detailPage(name: string, slug: 'projects' | 'notes', bodyField: string): EditorPage {
  const page = createEmptyPage(name, 'collection_detail')
  page.slug = `${slug}-detail`; page.routePattern = `/${slug}/:slug`; page.schema.collectionName = slug
  page.schema.root = [createNode('main', { styles: { desktop: { minHeight: '100vh', padding: '130px 5vw 90px', background: '#e7dfcb', color: '#17150f' }, mobile: { padding: '94px 20px 70px' } }, children: [fieldNode('p', slug === 'projects' ? 'technologies' : 'category', slug === 'projects' ? 'REACT · TYPESCRIPT' : 'FIELD NOTE', { margin: 0, fontSize: '11px', fontWeight: 850, letterSpacing: '.16em' }), fieldNode('h1', 'title', `${name} title`, { maxWidth: '1200px', margin: '24px 0 0', fontSize: 'clamp(62px,10vw,150px)', lineHeight: .8, letterSpacing: '-.08em' }), fieldNode('p', slug === 'projects' ? 'short_description' : 'summary', 'Summary', { maxWidth: '760px', margin: '36px 0 0', fontSize: '21px', lineHeight: 1.65 }), fieldNode('article', bodyField, 'Detailed content', { maxWidth: '900px', margin: '70px 0 0', paddingTop: '34px', borderTop: '2px solid #17150f', lineHeight: 1.85, whiteSpace: 'pre-wrap' })] })]
  return page
}

function simplePage(name: string): EditorPage {
  const page = createEmptyPage(name, 'standard')
  page.slug = slugify(name); page.routePattern = `/${page.slug}`
  page.schema.root = [createNode('main', { styles: { desktop: { minHeight: '100vh', padding: '130px 5vw 90px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: name === 'Contact' ? '#dfff00' : '#3157ff', color: name === 'Contact' ? '#101010' : '#ffffff' }, mobile: { padding: '94px 20px 70px' } }, children: [contentNode('p', name.toUpperCase(), `${page.slug}.eyebrow`, `${name} Eyebrow`, { margin: 0, fontSize: '11px', fontWeight: 900, letterSpacing: '.2em' }), contentNode('h1', name === 'About' ? 'A BUILDER BETWEEN DISCIPLINES.' : 'LET’S BUILD THE NEXT FRAME.', `${page.slug}.heading`, `${name} Heading`, { maxWidth: '1280px', margin: '26px 0 0', fontSize: 'clamp(68px,11vw,170px)', lineHeight: .78, letterSpacing: '-.083em' }, true), contentNode('p', `Edit this ${name.toLowerCase()} page from Admin Site Content or directly in Studio.`, `${page.slug}.body`, `${name} Body`, { maxWidth: '720px', margin: '40px 0 0', fontSize: '20px', lineHeight: 1.7 })] })]
  return page
}

export function createCinematicTransitionPortfolioTemplate(): EditorDocument {
  const pages = [
    createCinematicHeaderPage(), createHomePage(),
    collectionIndexPage('Projects', 'projects', 'projects', 'title', 'short_description'), detailPage('Project Detail', 'projects', 'full_description'),
    collectionIndexPage('Notes', 'notes', 'notes', 'title', 'summary'), detailPage('Note Detail', 'notes', 'content'),
    simplePage('About'), simplePage('Contact'), createCinematicFooterPage(),
  ]
  pages.forEach((page, index) => { if (page.pageType !== 'system') page.sortOrder = index })
  return {
    layoutId: null,
    layoutName: 'Cinematic Transition Portfolio',
    layoutSlug: 'cinematic-transition-portfolio',
    layoutDescription: 'Scroll-directed portfolio with one measured sticky stage, one neutral bridge, full-content scene travel, reversible directional transitions and a naturally releasing finale.',
    versionId: null,
    versionNumber: 1,
    versionStatus: 'draft',
    designTokens: {
      ...DEFAULT_DESIGN_TOKENS,
      variables: { '--site-bg': '#111111', '--site-surface': '#171717', '--site-surface-2': '#222222', '--site-text': '#ffffff', '--site-muted': 'rgba(255,255,255,.62)', '--site-border': 'rgba(255,255,255,.2)', '--site-primary': '#3157ff', '--site-accent': '#dfff00' },
      fonts: { heading: 'Inter, Arial Black, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      breakpoints: { desktop: 1440, tablet: 768, mobile: 375 },
    },
    pages,
  }
}
