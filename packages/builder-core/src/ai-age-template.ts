import { DEFAULT_DESIGN_TOKENS, type ConditionalStyleRule, type EditorDocument, type EditorPage, type StudioNode } from '@platform/contracts'
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

function editableLink(label: string, labelKey: string, href: string, hrefKey: string, primary = false): StudioNode {
  return createNode('a', {
    props: { text: label, href },
    bindings: {
      text: { type: 'content', key: labelKey, label: `${label} Label`, contentType: 'text', sample: label },
      href: { type: 'content', key: hrefKey, label: `${label} URL`, contentType: 'url', sample: href },
    },
    animation: { type: primary ? 'glow-hover' : 'lift-hover', trigger: 'hover', duration: 240, easing: 'ease-out' },
    styles: {
      desktop: primary
        ? { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '48px', padding: '0 22px', borderRadius: '999px', background: 'var(--site-text)', color: 'var(--site-bg)', textDecoration: 'none', fontWeight: 800, letterSpacing: '-.01em' }
        : { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '48px', padding: '0 22px', borderRadius: '999px', border: '1px solid var(--site-border)', background: 'rgba(255,255,255,.025)', color: 'var(--site-text)', textDecoration: 'none', fontWeight: 700 },
    },
  })
}

function sectionShell(label: string, children: StudioNode[], background = 'var(--site-bg)'): StudioNode {
  return createNode('section', {
    meta: { label, sectionLabel: label, adminLabel: label },
    scrollBehavior: { mode: 'normal', reducedMotionFallback: 'reduce' },
    styles: {
      desktop: { position: 'relative', minHeight: '90vh', padding: '120px 5vw', overflow: 'hidden', background, color: 'var(--site-text)', borderTop: '1px solid var(--site-border)' },
      tablet: { minHeight: 'auto', padding: '96px 36px' },
      mobile: { minHeight: 'auto', padding: '76px 20px' },
    },
    children,
  })
}

function sectionHeading(prefix: string, eyebrow: string, heading: string, description: string): StudioNode[] {
  return [
    contentNode('p', eyebrow, `${prefix}.eyebrow`, `${eyebrow} Eyebrow`, { margin: 0, color: 'var(--site-accent)', fontSize: '11px', fontWeight: 800, letterSpacing: '.22em' }),
    contentNode('h2', heading, `${prefix}.heading`, `${eyebrow} Heading`, { maxWidth: '920px', margin: '16px 0 0', fontSize: 'clamp(46px, 7vw, 96px)', lineHeight: '.94', letterSpacing: '-.065em' }, true),
    contentNode('p', description, `${prefix}.description`, `${eyebrow} Description`, { maxWidth: '680px', margin: '26px 0 0', color: 'var(--site-muted)', fontSize: '18px', lineHeight: 1.7 }),
  ]
}

function gridFx(): StudioNode {
  return createNode('div', {
    meta: { label: 'Perspective Grid' },
    animation: { type: 'parallax-y', trigger: 'scroll', duration: 1000, easing: 'linear', params: { strength: .12 } },
    styles: {
      desktop: { position: 'absolute', left: '-10%', right: '-10%', bottom: '-26%', height: '72%', pointerEvents: 'none', opacity: .34, backgroundImage: 'linear-gradient(rgba(101,247,226,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(157,124,255,.16) 1px, transparent 1px)', backgroundSize: '70px 70px', transform: 'perspective(650px) rotateX(62deg)', transformOrigin: 'center bottom', maskImage: 'linear-gradient(to top, #000, transparent 92%)' },
      mobile: { bottom: '-10%', height: '55%', backgroundSize: '42px 42px' },
    },
  })
}

function ambientFx(seed: number, opacity = .17): StudioNode {
  return createNode('ambient-field', {
    props: {
      contentMode: 'text', items: 'React\nTypeScript\nuseState()\nfetch()\nNode.js\nAI\nSYSTEM\n01', count: 20,
      minSize: 14, maxSize: 28, speed: .22, drift: 44, opacity, glow: .3, direction: 'random', distribution: 'edges', motion: 'float', seed,
      randomRotation: true, randomColors: true, colors: '#65f7e2, #9d7cff, #f4f5f7, #8a8d98',
    },
    styles: { desktop: { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' } },
    meta: { label: 'Ambient Code Field' },
  })
}

function orbitVisual(): StudioNode {
  const ring = (label: string, size: string, color: string, duration: number, direction: 'normal' | 'reverse' = 'normal') => createNode('div', {
    meta: { label },
    animation: { type: 'spin', trigger: 'continuous', duration, easing: 'linear', repeat: true, direction },
    styles: { desktop: { position: 'absolute', inset: 0, width: size, height: size, margin: 'auto', borderRadius: '50%', border: `1px solid ${color}`, boxShadow: `0 0 42px ${color}`, opacity: .7 } },
    children: [createNode('span', { props: { text: '●' }, styles: { desktop: { position: 'absolute', top: '-7px', left: '50%', color, fontSize: '13px', textShadow: `0 0 16px ${color}` } } })],
  })
  return createNode('div', {
    meta: { label: 'AI Orbit System', adminLabel: 'Hero Orbit Visual' },
    animation: { type: 'float', trigger: 'continuous', duration: 4200, easing: 'ease-in-out', repeat: true },
    styles: {
      desktop: { position: 'relative', width: 'min(480px, 38vw)', aspectRatio: '1', margin: '0 auto', borderRadius: '50%', background: 'radial-gradient(circle, rgba(101,247,226,.13), transparent 58%)', filter: 'drop-shadow(0 30px 70px rgba(0,0,0,.45))' },
      tablet: { width: 'min(460px, 72vw)' },
      mobile: { width: 'min(330px, 82vw)' },
    },
    children: [
      ring('Outer Cyan Orbit', '100%', 'rgba(101,247,226,.55)', 11000),
      ring('Violet Orbit', '76%', 'rgba(157,124,255,.7)', 7600, 'reverse'),
      ring('Inner Orbit', '50%', 'rgba(244,245,247,.28)', 5200),
      createNode('div', {
        meta: { label: 'AI Core' },
        animation: { type: 'pulse', trigger: 'continuous', duration: 2200, easing: 'ease-in-out', repeat: true },
        styles: { desktop: { position: 'absolute', inset: 0, width: '26%', aspectRatio: '1', margin: 'auto', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff, #65f7e2 18%, #7567ff 52%, #050507 76%)', boxShadow: '0 0 38px rgba(101,247,226,.8), 0 0 100px rgba(157,124,255,.45)' } },
        children: [createNode('span', { props: { text: 'AI' }, styles: { desktop: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#050507', fontWeight: 950, fontSize: 'clamp(18px,3vw,34px)', letterSpacing: '-.08em' } } })],
      }),
    ],
  })
}

function metric(value: string, label: string, key: string): StudioNode {
  return createNode('div', {
    styles: { desktop: { minWidth: '150px', padding: '18px 0', borderTop: '1px solid var(--site-border)' } },
    children: [
      contentNode('p', value, `${key}.value`, `${label} Value`, { margin: 0, color: 'var(--site-text)', fontSize: '28px', fontWeight: 850, letterSpacing: '-.04em' }),
      contentNode('p', label, `${key}.label`, `${label} Label`, { margin: '5px 0 0', color: 'var(--site-muted)', fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase' }),
    ],
  })
}

function heroSection(): StudioNode {
  return createNode('section', {
    meta: { label: 'Hero', sectionLabel: 'Hero', adminLabel: 'Hero' },
    scrollBehavior: { mode: 'normal', reducedMotionFallback: 'reduce' },
    bindings: { 'style.backgroundImage': { type: 'content', key: 'home.hero.backgroundImage', label: 'Hero Background Image', contentType: 'media', sample: '' } },
    styles: {
      desktop: { position: 'relative', minHeight: 'calc(100vh - 42px)', padding: '110px 5vw 48px', overflow: 'hidden', color: 'var(--site-text)', background: 'radial-gradient(circle at 78% 28%, rgba(157,124,255,.18), transparent 28%), radial-gradient(circle at 24% 72%, rgba(101,247,226,.11), transparent 30%), var(--site-bg)', backgroundSize: 'cover', backgroundPosition: 'center' },
      tablet: { padding: '100px 36px 44px' },
      mobile: { minHeight: 'auto', padding: '86px 20px 38px' },
    },
    children: [
      gridFx(), ambientFx(41, .12),
      createNode('div', {
        styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1380px,100%)', minHeight: '70vh', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.13fr .87fr', gap: '64px', alignItems: 'center' }, tablet: { gridTemplateColumns: '1fr', minHeight: 'auto', gap: '54px' } },
        children: [
          createNode('div', { children: [
            contentNode('p', 'FULL-STACK ENGINEER · AI PRODUCT BUILDER', 'home.hero.eyebrow', 'Hero Eyebrow', { margin: '0 0 20px', color: 'var(--site-accent)', fontSize: '11px', fontWeight: 800, letterSpacing: '.2em' }),
            contentNode('h1', 'I BUILD DIGITAL SYSTEMS', 'home.hero.heading', 'Hero Heading', { maxWidth: '880px', margin: 0, fontSize: 'clamp(58px, 8vw, 126px)', lineHeight: '.83', letterSpacing: '-.078em', fontWeight: 900 }, true),
            contentNode('p', 'FOR THE AI AGE.', 'home.hero.displayLine', 'Hero Display Line', { margin: '8px 0 0', color: 'transparent', WebkitTextStroke: '1px rgba(244,245,247,.78)', fontSize: 'clamp(58px, 8vw, 126px)', lineHeight: '.84', letterSpacing: '-.078em', fontWeight: 900 }, true),
            contentNode('p', 'I turn complex ideas into fast, resilient products—combining interface craft, reliable systems and applied AI.', 'home.hero.description', 'Hero Description', { maxWidth: '700px', margin: '34px 0 0', color: 'var(--site-muted)', fontSize: 'clamp(17px,1.7vw,21px)', lineHeight: 1.65 }, true),
            createNode('div', { styles: { desktop: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '34px' } }, children: [
              editableLink('Explore selected work', 'home.hero.primaryCtaLabel', '/projects', 'home.hero.primaryCtaUrl', true),
              editableLink('Start a conversation', 'home.hero.secondaryCtaLabel', '/contact', 'home.hero.secondaryCtaUrl'),
            ] }),
          ], animation: { type: 'fade-up', trigger: 'load', duration: 850, easing: 'ease-out' } }),
          orbitVisual(),
        ],
      }),
      createNode('div', {
        styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1380px,100%)', margin: '30px auto 0', display: 'flex', gap: '48px', flexWrap: 'wrap' }, mobile: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0 18px' } },
        children: [metric('04+', 'Years building', 'home.hero.metricYears'), metric('18', 'Products shipped', 'home.hero.metricProducts'), metric('99.9%', 'Reliability mindset', 'home.hero.metricReliability')],
      }),
    ],
  })
}

function marqueeSection(): StudioNode {
  return createNode('section', {
    meta: { label: 'Capability Marquee', sectionLabel: 'Capability Marquee' },
    styles: { desktop: { position: 'relative', padding: '18px 0', overflow: 'hidden', background: '#08080c', borderTop: '1px solid var(--site-border)', borderBottom: '1px solid var(--site-border)', color: 'var(--site-muted)' } },
    children: [createNode('code-stream', {
      props: { lines: 'PRODUCT ENGINEERING  ✦  REACT  ✦  TYPESCRIPT  ✦  NODE.JS  ✦  POSTGRES  ✦  APPLIED AI  ✦  DESIGN SYSTEMS  ✦  QUALITY  ✦  DELIVERY', direction: 'left', speed: .55, gap: 44, edgeFade: 70 },
      styles: { desktop: { position: 'relative', width: '100%', height: '46px', overflow: 'hidden', display: 'flex', alignItems: 'center', color: 'var(--site-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', letterSpacing: '.13em', opacity: .9, pointerEvents: 'none' } },
      meta: { label: 'Moving Capability Marquee' },
    })],
  })
}

function projectVisual(): StudioNode {
  return createNode('div', {
    meta: { label: 'Project Interface Visual' },
    styles: { desktop: { position: 'relative', minHeight: '330px', padding: '22px', overflow: 'hidden', borderBottom: '1px solid var(--site-border)', background: 'radial-gradient(circle at 70% 28%, rgba(101,247,226,.18), transparent 35%), #08080d' }, mobile: { minHeight: '250px', padding: '16px' } },
    children: [
      createNode('div', { styles: { desktop: { height: '100%', minHeight: '286px', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,.14)', background: 'rgba(8,8,12,.86)', boxShadow: '0 24px 70px rgba(0,0,0,.4)' }, mobile: { minHeight: '215px' } }, children: [
        createNode('div', { styles: { desktop: { display: 'flex', alignItems: 'center', gap: '7px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,.1)' } }, children: [
          createNode('span', { props: { text: '●' }, styles: { desktop: { color: '#ff6b6b', fontSize: '10px' } } }),
          createNode('span', { props: { text: '●' }, styles: { desktop: { color: '#ffd166', fontSize: '10px' } } }),
          createNode('span', { props: { text: '●' }, styles: { desktop: { color: '#65f7e2', fontSize: '10px' } } }),
          createNode('span', { props: { text: 'SYSTEM PREVIEW' }, styles: { desktop: { marginLeft: 'auto', color: 'var(--site-muted)', fontSize: '9px', letterSpacing: '.14em' } } }),
        ] }),
        createNode('div', { styles: { desktop: { display: 'grid', gridTemplateColumns: '94px 1fr', gap: '12px', minHeight: '222px', paddingTop: '12px' }, mobile: { gridTemplateColumns: '70px 1fr' } }, children: [
          createNode('div', { styles: { desktop: { display: 'grid', alignContent: 'start', gap: '8px', padding: '10px', borderRadius: '9px', background: 'rgba(255,255,255,.035)' } }, children: [
            createNode('span', { props: { text: '01' }, styles: { desktop: { padding: '7px', borderRadius: '6px', background: 'rgba(101,247,226,.12)', color: 'var(--site-accent)', fontFamily: 'monospace', fontSize: '10px' } } }),
            createNode('span', { props: { text: '02' }, styles: { desktop: { padding: '7px', color: 'var(--site-muted)', fontFamily: 'monospace', fontSize: '10px' } } }),
            createNode('span', { props: { text: '03' }, styles: { desktop: { padding: '7px', color: 'var(--site-muted)', fontFamily: 'monospace', fontSize: '10px' } } }),
          ] }),
          createNode('code-stream', { props: { lines: 'const idea = await discover();\nconst system = design(idea);\nawait build(system);\nship({ quality: true });', direction: 'up', speed: .32, gap: 18, edgeFade: 20 }, styles: { desktop: { position: 'relative', width: '100%', height: '220px', padding: '14px', overflow: 'hidden', borderRadius: '9px', background: 'rgba(0,0,0,.35)', color: 'var(--site-accent)', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.8, opacity: .8, pointerEvents: 'none' } }, meta: { label: 'Project Code Stream' } }),
        ] }),
      ] }),
    ],
  })
}

function projectsSection(): StudioNode {
  const projectCollection = createNode('collection', {
    meta: { label: 'Selected Projects', adminLabel: 'Projects' },
    props: { collection: 'projects', emptyText: 'Add featured, published projects from Admin → Projects.' },
    bindings: { items: { type: 'collection', collection: 'projects', filters: [{ field: 'featured', operator: 'eq', value: true }], sort: [{ field: 'display_order', direction: 'asc' }], limit: 4 } },
    styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '22px', marginTop: '64px' }, tablet: { gridTemplateColumns: '1fr' } },
    children: [createNode('article', {
      meta: { label: 'Project Card', sectionLabel: 'Project Card' },
      animation: { type: 'fade-up', trigger: 'scroll', duration: 780, easing: 'ease-out', stagger: 130, repeat: true },
      conditionalStyles: [
        { when: { left: { source: 'context', key: 'collectionPosition' }, operator: 'eq', right: { source: 'literal', value: 1 } }, styles: { desktop: { boxShadow: '0 30px 110px rgba(101,247,226,.08)' } } },
        { when: { left: { source: 'context', key: 'collectionPosition' }, operator: 'eq', right: { source: 'literal', value: 2 } }, styles: { desktop: { boxShadow: '0 30px 110px rgba(157,124,255,.1)' } } },
      ],
      styles: { desktop: { overflow: 'hidden', borderRadius: '22px', border: '1px solid var(--site-border)', background: 'var(--site-surface)' } },
      children: [
        projectVisual(),
        createNode('div', { styles: { desktop: { padding: '28px 28px 30px' }, mobile: { padding: '22px' } }, children: [
          createNode('p', { bindings: { text: { type: 'template', template: '0{{context:collectionPosition}}  /  {{field:technologies}}' } }, styles: { desktop: { margin: 0, color: 'var(--site-accent)', fontSize: '10px', fontWeight: 700, letterSpacing: '.13em' } } }),
          fieldNode('h3', 'title', 'Project title', { margin: '16px 0 0', fontSize: 'clamp(28px,3vw,42px)', letterSpacing: '-.045em' }),
          fieldNode('p', 'short_description', 'A concise description of the system and the result it creates.', { margin: '14px 0 0', color: 'var(--site-muted)', lineHeight: 1.7 }),
          createNode('a', { props: { text: 'VIEW CASE STUDY  ↗', href: '/projects' }, bindings: { href: { type: 'template', template: '/projects/{{field:slug}}', fallback: '/projects' } }, animation: { type: 'lift-hover', trigger: 'hover', duration: 220, easing: 'ease-out' }, styles: { desktop: { display: 'inline-flex', marginTop: '24px', color: 'var(--site-text)', textDecoration: 'none', fontSize: '11px', fontWeight: 800, letterSpacing: '.12em' } } }),
        ] }),
      ],
    })],
  })
  return sectionShell('Selected Work', [
    ambientFx(73, .08),
    createNode('div', { styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1380px,100%)', margin: '0 auto' } }, children: [
      ...sectionHeading('home.projects', 'SELECTED WORK', 'Systems designed to move ideas forward.', 'A small selection of product, platform and interface work. Every card is driven by the Projects collection.'),
      projectCollection,
    ] }),
  ], '#060609')
}

function statCard(value: string, label: string, key: string): StudioNode {
  return createNode('div', {
    animation: { type: 'fade-up', trigger: 'scroll', duration: 650, easing: 'ease-out', repeat: true },
    styles: { desktop: { minHeight: '190px', padding: '26px', borderRadius: '18px', border: '1px solid var(--site-border)', background: 'linear-gradient(145deg, rgba(255,255,255,.04), rgba(255,255,255,.01))' } },
    children: [contentNode('p', value, `${key}.value`, `${label} Value`, { margin: 0, color: 'var(--site-accent)', fontSize: 'clamp(42px,5vw,68px)', fontWeight: 880, letterSpacing: '-.065em' }), contentNode('p', label, `${key}.label`, `${label} Label`, { margin: '18px 0 0', color: 'var(--site-muted)', fontSize: '11px', lineHeight: 1.5, letterSpacing: '.12em', textTransform: 'uppercase' })],
  })
}

function experienceSection(): StudioNode {
  const experienceCollection = createNode('collection', {
    meta: { label: 'Experience Timeline', adminLabel: 'Experience' },
    props: { collection: 'experience', emptyText: 'Add published experience from Admin → Experience.' },
    bindings: { items: { type: 'collection', collection: 'experience', sort: [{ field: 'display_order', direction: 'asc' }], limit: 4 } },
    styles: { desktop: { display: 'grid', gap: '12px', marginTop: '42px' } },
    children: [createNode('article', {
      animation: { type: 'reveal', trigger: 'scroll', duration: 760, easing: 'ease-out', stagger: 110, repeat: true },
      styles: { desktop: { display: 'grid', gridTemplateColumns: '190px minmax(180px,.7fr) 1.4fr', gap: '28px', alignItems: 'start', padding: '26px 0', borderTop: '1px solid var(--site-border)' }, mobile: { gridTemplateColumns: '1fr', gap: '8px' } },
      children: [
        createNode('p', { bindings: { text: { type: 'template', template: '{{field:start_date}} — {{field:end_date}}' } }, styles: { desktop: { margin: 0, color: 'var(--site-muted)', fontFamily: 'monospace', fontSize: '11px' } } }),
        createNode('div', { children: [fieldNode('h3', 'role', 'Product Engineer', { margin: 0, fontSize: '22px', letterSpacing: '-.025em' }), fieldNode('p', 'company', 'Company', { margin: '7px 0 0', color: 'var(--site-accent)', fontSize: '12px' })] }),
        createNode('div', { children: [fieldNode('p', 'summary', 'What changed because of the work.', { margin: 0, color: 'var(--site-muted)', lineHeight: 1.7 }), fieldNode('p', 'technologies', 'React • Node.js • PostgreSQL', { margin: '13px 0 0', color: 'var(--site-text)', fontSize: '11px' })] }),
      ],
    })],
  })
  return sectionShell('Experience', [
    gridFx(),
    createNode('div', { styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1380px,100%)', margin: '0 auto', display: 'grid', gridTemplateColumns: '.82fr 1.18fr', gap: '80px', alignItems: 'start' }, tablet: { gridTemplateColumns: '1fr', gap: '54px' } }, children: [
      createNode('div', { styles: { desktop: { position: 'sticky', top: '120px' }, tablet: { position: 'relative', top: 'auto' } }, children: [
        ...sectionHeading('home.experience', 'EXPERIENCE', 'Measured by outcomes, not activity.', 'I enjoy the part where a vague problem becomes a calm, dependable system.'),
        createNode('div', { styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px', marginTop: '42px' }, mobile: { gridTemplateColumns: '1fr' } }, children: [statCard('41%', 'Faster delivery cycles', 'home.experience.statOne'), statCard('3×', 'Reusable system leverage', 'home.experience.statTwo')] }),
      ] }),
      createNode('div', { children: [experienceCollection] }),
    ] }),
  ], '#09090d')
}

function categoryActiveRules(): ConditionalStyleRule[] {
  return [
    { when: { left: { source: 'state', key: 'tech.category', fallback: 'frontend' }, operator: 'eq', right: { source: 'field', key: 'category_key' } }, styles: { desktop: { color: '#050507', opacity: 1, background: 'var(--site-accent)', borderColor: 'var(--site-accent)', transform: 'translateX(6px)', boxShadow: '0 0 30px rgba(101,247,226,.16)' }, mobile: { transform: 'translateX(0)' } } },
    { when: { left: { source: 'state', key: 'tech.category', fallback: 'frontend' }, operator: 'neq', right: { source: 'field', key: 'category_key' } }, styles: { desktop: { color: 'var(--site-muted)', opacity: .78, background: 'transparent', borderColor: 'var(--site-border)', transform: 'translateX(0)', boxShadow: 'none' } } },
  ]
}

function capabilitiesSection(): StudioNode {
  const categories = createNode('collection', {
    meta: { label: 'Technology Categories', adminLabel: 'Technology Categories' },
    props: { collection: 'technology_categories', emptyText: 'Add published Technology Categories in Admin.' },
    bindings: { items: { type: 'collection', collection: 'technology_categories', sort: [{ field: 'display_order', direction: 'asc' }] } },
    styles: { desktop: { display: 'flex', flexDirection: 'column', gap: '8px' }, mobile: { flexDirection: 'row', flexWrap: 'wrap', gap: '8px' } },
    children: [createNode('button', {
      meta: { label: 'Technology Category Button' },
      props: { text: '01 FRONTEND', type: 'button' },
      bindings: { text: { type: 'field', field: 'label', fallback: '01 FRONTEND' } },
      interactions: [{ event: 'click', actions: [{ type: 'set-state', key: 'tech.category', value: { source: 'field', key: 'category_key', fallback: 'frontend' } }] }],
      conditionalStyles: categoryActiveRules(),
      styles: { desktop: { width: '100%', minHeight: '48px', padding: '0 15px', borderRadius: '9px', border: '1px solid var(--site-border)', background: 'transparent', color: 'var(--site-muted)', textAlign: 'left', cursor: 'pointer', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', fontWeight: 750, letterSpacing: '.05em', transition: 'all 180ms ease' }, mobile: { width: 'auto', minHeight: '42px', padding: '0 13px', borderRadius: '999px', fontSize: '10px', textAlign: 'center' } },
    })],
  })

  const technologies = createNode('collection', {
    meta: { label: 'Filtered Technologies', adminLabel: 'Technologies' },
    props: { collection: 'technologies', emptyText: 'Add published technologies whose category matches the selected category_key.' },
    bindings: { items: { type: 'collection', collection: 'technologies', filters: [{ field: 'category', operator: 'eq', value: { source: 'state', key: 'tech.category', fallback: 'frontend' } }], sort: [{ field: 'display_order', direction: 'asc' }], countStateKey: 'tech.visibleCount' } },
    styles: { desktop: { display: 'grid', gap: '2px', marginTop: '20px' } },
    children: [createNode('div', {
      animation: { type: 'fade-up', trigger: 'scroll', duration: 420, easing: 'ease-out', stagger: 75, repeat: true, replayOnState: ['tech.category'] },
      styles: { desktop: { display: 'grid', gridTemplateColumns: '30px minmax(140px,.8fr) minmax(180px,1.2fr)', gap: '10px', alignItems: 'center', minHeight: '44px', borderBottom: '1px solid rgba(255,255,255,.065)' }, mobile: { gridTemplateColumns: '24px 1fr', gap: '8px' } },
      children: [
        createNode('span', { props: { text: '✓' }, styles: { desktop: { color: 'var(--site-accent)' } } }),
        fieldNode('code', 'name', 'Technology', { color: 'var(--site-text)', fontSize: '12px' }),
        fieldNode('code', 'install_command', 'install command', { color: 'var(--site-muted)', fontSize: '11px', textAlign: 'right' }),
      ],
    })],
  })

  const terminal = createNode('div', {
    meta: { label: 'Capability Console', sectionLabel: 'Capability Console' },
    styles: { desktop: { overflow: 'hidden', borderRadius: '20px', border: '1px solid var(--site-border)', background: '#07070a', boxShadow: '0 34px 120px rgba(0,0,0,.45)' } },
    children: [
      createNode('div', { styles: { desktop: { display: 'flex', alignItems: 'center', gap: '7px', padding: '15px 18px', borderBottom: '1px solid var(--site-border)', color: 'var(--site-muted)' } }, children: [
        createNode('span', { props: { text: '● ● ●' }, styles: { desktop: { color: '#767782', letterSpacing: '.25em', fontSize: '10px' } } }),
        createNode('span', { bindings: { text: { type: 'template', template: 'capabilities://{{state:tech.category}}' } }, styles: { desktop: { marginLeft: 'auto', color: 'var(--site-muted)', fontFamily: 'monospace', fontSize: '10px' } } }),
      ] }),
      createNode('div', { styles: { desktop: { padding: '30px' }, mobile: { padding: '20px' } }, children: [
        createNode('code', { bindings: { text: { type: 'template', template: '$ initialize --domain {{state:tech.category}}' } }, animation: { type: 'typewriter', trigger: 'load', duration: 900, easing: 'linear', replayOnState: ['tech.category'] }, styles: { desktop: { display: 'block', color: 'var(--site-accent)', fontSize: '12px' } } }),
        createNode('p', { bindings: { text: { type: 'template', template: 'Resolving {{state:tech.visibleCount}} production-ready tools…' } }, animation: { type: 'fade', trigger: 'load', duration: 380, delay: 180, easing: 'ease-out', replayOnState: ['tech.category'] }, styles: { desktop: { margin: '22px 0 0', color: 'var(--site-muted)', fontFamily: 'monospace', fontSize: '11px' } } }),
        technologies,
        createNode('code', { bindings: { text: { type: 'template', template: '✓ {{state:tech.category}} stack ready.' } }, animation: { type: 'typewriter', trigger: 'load', duration: 760, delay: 300, easing: 'linear', replayOnState: ['tech.category'] }, styles: { desktop: { display: 'block', marginTop: '26px', color: '#9bf5ad', fontSize: '11px' } } }),
      ] }),
    ],
  })

  return sectionShell('Capabilities', [
    ambientFx(109, .09),
    createNode('div', { styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1380px,100%)', margin: '0 auto' } }, children: [
      ...sectionHeading('home.capabilities', 'CAPABILITY SYSTEM', 'The stack behind what I build.', 'Choose a collection-driven domain to replay the console and inspect its technologies.'),
      createNode('div', { styles: { desktop: { display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: '22px', marginTop: '60px' }, tablet: { gridTemplateColumns: '220px minmax(0,1fr)' }, mobile: { gridTemplateColumns: '1fr', marginTop: '42px' } }, children: [categories, terminal] }),
    ] }),
  ], '#07070b')
}

function aboutSection(): StudioNode {
  return sectionShell('About and Learning', [
    gridFx(),
    createNode('div', { styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1380px,100%)', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.12fr .88fr', gap: '70px', alignItems: 'center' }, tablet: { gridTemplateColumns: '1fr', gap: '46px' } }, children: [
      createNode('div', { children: [
        ...sectionHeading('home.about', 'ABOUT / NOW', 'Curiosity is part of the architecture.', 'I care about the invisible qualities of a product: clarity, maintainability, graceful failure and the feeling that every detail belongs.'),
        contentNode('p', 'Currently exploring agentic workflows, multimodal interfaces and better ways for humans to steer intelligent systems.', 'home.about.currentFocus', 'Current Focus', { maxWidth: '720px', margin: '26px 0 0', color: 'var(--site-text)', fontSize: '20px', lineHeight: 1.65 }),
        editableLink('Read more about me', 'home.about.ctaLabel', '/about', 'home.about.ctaUrl'),
      ] }),
      createNode('div', {
        meta: { label: 'Learning Orbit Card', sectionLabel: 'Learning Card' },
        animation: { type: 'tilt-3d', trigger: 'hover', duration: 260, easing: 'ease-out' },
        styles: { desktop: { position: 'relative', minHeight: '500px', padding: '34px', overflow: 'hidden', borderRadius: '28px', border: '1px solid var(--site-border)', background: 'radial-gradient(circle at 66% 32%, rgba(157,124,255,.24), transparent 34%), linear-gradient(145deg, rgba(255,255,255,.05), rgba(255,255,255,.01))', boxShadow: '0 38px 120px rgba(0,0,0,.35)' }, mobile: { minHeight: '420px', padding: '24px' } },
        children: [
          createNode('div', { animation: { type: 'orbit', trigger: 'continuous', duration: 9000, easing: 'linear', repeat: true }, styles: { desktop: { position: 'absolute', width: '310px', height: '310px', right: '-45px', top: '30px', borderRadius: '50%', border: '1px solid rgba(157,124,255,.55)' } }, children: [createNode('span', { props: { text: '●' }, styles: { desktop: { position: 'absolute', top: '-8px', left: '50%', color: 'var(--site-violet)', textShadow: '0 0 18px var(--site-violet)' } } })] }),
          contentNode('p', 'LEARNING QUEUE', 'home.about.cardEyebrow', 'Learning Card Eyebrow', { position: 'relative', margin: 0, color: 'var(--site-accent)', fontSize: '10px', fontWeight: 800, letterSpacing: '.18em' }),
          contentNode('h3', 'What I am exploring next.', 'home.about.cardHeading', 'Learning Card Heading', { position: 'relative', maxWidth: '340px', margin: '22px 0 0', fontSize: '42px', lineHeight: 1, letterSpacing: '-.055em' }),
          createNode('div', { styles: { desktop: { position: 'absolute', left: '34px', right: '34px', bottom: '34px', display: 'grid', gap: '9px' }, mobile: { left: '24px', right: '24px', bottom: '24px' } }, children: [
            contentNode('p', '01  AGENTIC PRODUCT FLOWS', 'home.about.learningOne', 'Learning Topic 1', { margin: 0, padding: '13px 0', borderTop: '1px solid var(--site-border)', color: 'var(--site-text)', fontFamily: 'monospace', fontSize: '11px' }),
            contentNode('p', '02  GENERATIVE INTERFACES', 'home.about.learningTwo', 'Learning Topic 2', { margin: 0, padding: '13px 0', borderTop: '1px solid var(--site-border)', color: 'var(--site-text)', fontFamily: 'monospace', fontSize: '11px' }),
            contentNode('p', '03  RELIABLE AI SYSTEMS', 'home.about.learningThree', 'Learning Topic 3', { margin: 0, padding: '13px 0', borderTop: '1px solid var(--site-border)', color: 'var(--site-text)', fontFamily: 'monospace', fontSize: '11px' }),
          ] }),
        ],
      }),
    ] }),
  ], '#09090d')
}

function contactSection(): StudioNode {
  return sectionShell('Contact Finale', [
    ambientFx(151, .12),
    createNode('particle-field', { props: { count: 54, minSize: 1, maxSize: 3, speed: .18, drift: 28, opacity: .38, glow: .72, direction: 'up', colors: '#65f7e2, #9d7cff, #f4f5f7', seed: 151, motion: 'continuous' }, styles: { desktop: { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' } }, meta: { label: 'Contact Particle Field' } }),
    createNode('div', { styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1180px,100%)', margin: '0 auto', textAlign: 'center' } }, children: [
      contentNode('p', 'HAVE AN IDEA?', 'home.contact.eyebrow', 'Contact Eyebrow', { margin: 0, color: 'var(--site-accent)', fontSize: '11px', fontWeight: 800, letterSpacing: '.22em' }),
      contentNode('h2', 'Let’s make the future feel usable.', 'home.contact.heading', 'Contact Heading', { margin: '22px auto 0', fontSize: 'clamp(58px,9vw,132px)', lineHeight: '.85', letterSpacing: '-.078em' }, true),
      contentNode('p', 'Tell me about the product, platform or impossible-looking problem you want to move forward.', 'home.contact.description', 'Contact Description', { maxWidth: '650px', margin: '30px auto 0', color: 'var(--site-muted)', fontSize: '19px', lineHeight: 1.7 }),
      createNode('div', { styles: { desktop: { display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '38px' } }, children: [editableLink('Begin a project', 'home.contact.ctaLabel', '/contact', 'home.contact.ctaUrl', true), editableLink('hello@example.com', 'home.contact.emailLabel', 'mailto:hello@example.com', 'home.contact.emailUrl')] }),
    ], animation: { type: 'scale-blur-in', trigger: 'scroll', duration: 900, easing: 'ease-out', repeat: true } }),
  ], 'radial-gradient(circle at 50% 42%, rgba(101,247,226,.13), transparent 27%), radial-gradient(circle at 50% 54%, rgba(157,124,255,.13), transparent 42%), #050507')
}

function createAiAgeHeaderPage(): EditorPage {
  const page = createEmptyPage('Header', 'system')
  page.slug = '_header'; page.routePattern = '__header'; page.sortOrder = -100
  page.schema.root = [createNode('header', {
    meta: { label: 'Global Glass Header', sectionLabel: 'Header', adminLabel: 'Header' },
    styles: { desktop: { position: 'sticky', top: 0, zIndex: 1000, padding: '14px 3vw', background: 'rgba(5,5,7,.78)', backdropFilter: 'blur(22px)', borderBottom: '1px solid rgba(255,255,255,.08)', color: 'var(--site-text)' }, mobile: { padding: '11px 14px' } },
    children: [createNode('div', {
      styles: { desktop: { width: 'min(1440px,100%)', minHeight: '54px', margin: '0 auto', padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderRadius: '999px', border: '1px solid var(--site-border)', background: 'rgba(11,11,16,.82)' }, mobile: { gridTemplateColumns: '1fr auto', padding: '0 14px' } },
      children: [
        createNode('a', { props: { text: 'MUSTAFA / 01', href: '/' }, bindings: { text: { type: 'content', key: 'site.brand.name', label: 'Brand Name', contentType: 'text', sample: 'MUSTAFA / 01', required: true } }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none', fontSize: '11px', fontWeight: 850, letterSpacing: '.12em' } } }),
        createNode('nav', { styles: { desktop: { display: 'flex', gap: '24px', alignItems: 'center' }, mobile: { display: 'none' } }, children: [
          createNode('a', { props: { text: 'WORK', href: '/projects' }, styles: { desktop: { color: 'var(--site-muted)', textDecoration: 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '.12em' } } }),
          createNode('a', { props: { text: 'NOTES', href: '/notes' }, styles: { desktop: { color: 'var(--site-muted)', textDecoration: 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '.12em' } } }),
          createNode('a', { props: { text: 'ABOUT', href: '/about' }, styles: { desktop: { color: 'var(--site-muted)', textDecoration: 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '.12em' } } }),
          createNode('a', { props: { text: 'CONTACT', href: '/contact' }, styles: { desktop: { color: 'var(--site-muted)', textDecoration: 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '.12em' } } }),
        ] }),
        createNode('div', { styles: { desktop: { justifySelf: 'end', display: 'flex', gap: '8px', alignItems: 'center' } }, children: [
          createNode('span', { props: { text: '●' }, animation: { type: 'pulse', trigger: 'continuous', duration: 1600, easing: 'ease-in-out', repeat: true }, styles: { desktop: { color: '#65f7e2', fontSize: '9px', textShadow: '0 0 12px #65f7e2' } } }),
          contentNode('span', 'AVAILABLE', 'site.availability.label', 'Availability Label', { color: 'var(--site-muted)', fontSize: '9px', fontWeight: 700, letterSpacing: '.12em' }),
        ] }),
      ],
    })],
  })]
  return page
}

function createAiAgeFooterPage(): EditorPage {
  const page = createEmptyPage('Footer', 'system')
  page.slug = '_footer'; page.routePattern = '__footer'; page.sortOrder = 10000
  page.schema.root = [createNode('footer', {
    meta: { label: 'Global Footer', sectionLabel: 'Footer', adminLabel: 'Footer' },
    styles: { desktop: { padding: '34px 5vw', display: 'flex', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap', background: '#050507', color: 'var(--site-muted)', borderTop: '1px solid var(--site-border)' } },
    children: [
      contentNode('p', '© 2026 Mustafa. Designed to keep evolving.', 'footer.copyright', 'Footer Copyright', { margin: 0, fontSize: '11px' }),
      createNode('div', { styles: { desktop: { display: 'flex', gap: '18px' } }, children: [
        createNode('a', { props: { text: 'GITHUB' }, bindings: { href: { type: 'setting', key: 'site.social.github', label: 'GitHub URL', sample: 'https://github.com/' } }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none', fontSize: '10px', letterSpacing: '.12em' } } }),
        createNode('a', { props: { text: 'LINKEDIN' }, bindings: { href: { type: 'setting', key: 'site.social.linkedin', label: 'LinkedIn URL', sample: 'https://linkedin.com/' } }, styles: { desktop: { color: 'var(--site-text)', textDecoration: 'none', fontSize: '10px', letterSpacing: '.12em' } } }),
      ] }),
    ],
  })]
  return page
}

function createAiAgeHomePage(): EditorPage {
  const page = createEmptyPage('Home', 'home')
  page.schema.initialState = { 'tech.category': 'frontend', 'tech.visibleCount': 0 }
  page.seoDefaults = { title: 'Mustafa — Product Engineer for the AI Age', description: 'Full-stack product engineering, interface systems and applied AI.' }
  page.schema.root = [createNode('main', {
    meta: { label: 'AI Age Homepage', sectionLabel: 'Homepage' },
    styles: { desktop: { position: 'relative', overflow: 'hidden', background: 'var(--site-bg)', color: 'var(--site-text)' } },
    children: [heroSection(), marqueeSection(), projectsSection(), experienceSection(), capabilitiesSection(), aboutSection(), contactSection()],
  })]
  return page
}

function createCollectionIndexPage(name: string, slug: string, collection: string, titleField: string, summaryField: string): EditorPage {
  const page = createEmptyPage(name, 'collection_index')
  page.slug = slug; page.routePattern = `/${slug}`; page.schema.collectionName = collection
  page.seoDefaults = { title: name, description: `${name} from Mustafa's portfolio.` }
  page.schema.root = [createNode('main', { styles: { desktop: { minHeight: '82vh', padding: '110px 5vw', background: 'var(--site-bg)', color: 'var(--site-text)' }, mobile: { padding: '76px 20px' } }, children: [
    ...sectionHeading(`${slug}.index`, name.toUpperCase(), name === 'Projects' ? 'Selected systems and experiments.' : `Latest ${name.toLowerCase()}.`, `Collection-backed ${name.toLowerCase()}—add, remove or reorder items from Admin.`),
    createNode('collection', { props: { collection, emptyText: `Add ${name.toLowerCase()} from Admin.` }, bindings: { items: { type: 'collection', collection, sort: [{ field: 'display_order', direction: 'asc' }] } }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '18px', marginTop: '54px' }, tablet: { gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }, mobile: { gridTemplateColumns: '1fr' } }, children: [
      createNode('article', { animation: { type: 'fade-up', trigger: 'scroll', duration: 680, easing: 'ease-out', stagger: 100, repeat: true }, styles: { desktop: { minHeight: '260px', padding: '26px', display: 'flex', flexDirection: 'column', borderRadius: '18px', border: '1px solid var(--site-border)', background: 'var(--site-surface)' } }, children: [
        createNode('p', { bindings: { text: { type: 'template', template: '0{{context:collectionPosition}} / {{context:collectionCount}}' } }, styles: { desktop: { margin: 0, color: 'var(--site-accent)', fontFamily: 'monospace', fontSize: '10px' } } }),
        fieldNode('h2', titleField, `${name} item`, { margin: 'auto 0 10px', fontSize: '29px', letterSpacing: '-.04em' }),
        fieldNode('p', summaryField, 'Description', { margin: 0, color: 'var(--site-muted)', lineHeight: 1.65 }),
        createNode('a', { props: { text: 'OPEN  ↗', href: `/${slug}` }, bindings: { href: { type: 'template', template: `/${slug}/{{field:slug}}`, fallback: `/${slug}` } }, styles: { desktop: { marginTop: '20px', color: 'var(--site-text)', textDecoration: 'none', fontSize: '10px', fontWeight: 800, letterSpacing: '.12em' } } }),
      ] }),
    ] }),
  ] })]
  return page
}

function createDetailPage(name: string, collection: 'projects' | 'notes', bodyField: string): EditorPage {
  const page = createEmptyPage(name, 'collection_detail')
  page.slug = slugify(name); page.routePattern = `/${collection}/:slug`; page.schema.collectionName = collection
  page.schema.root = [createNode('main', { styles: { desktop: { minHeight: '82vh', padding: '110px 5vw', background: 'radial-gradient(circle at 78% 16%, rgba(157,124,255,.12), transparent 26%), var(--site-bg)', color: 'var(--site-text)' }, mobile: { padding: '76px 20px' } }, children: [
    fieldNode('p', collection === 'projects' ? 'technologies' : 'category', collection === 'projects' ? 'React • TypeScript' : 'NOTE', { margin: 0, color: 'var(--site-accent)', fontSize: '11px', letterSpacing: '.14em' }),
    fieldNode('h1', 'title', `${name} Title`, { maxWidth: '1080px', margin: '22px 0 0', fontSize: 'clamp(54px,8vw,112px)', lineHeight: '.9', letterSpacing: '-.07em' }),
    fieldNode('p', collection === 'projects' ? 'short_description' : 'summary', 'Summary', { maxWidth: '780px', margin: '30px 0 0', color: 'var(--site-muted)', fontSize: '20px', lineHeight: 1.7 }),
    fieldNode('article', bodyField, 'Detailed content', { maxWidth: '920px', margin: '70px 0 0', paddingTop: '36px', borderTop: '1px solid var(--site-border)', color: 'var(--site-text)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }),
  ] })]
  return page
}

function createSimplePage(name: string): EditorPage {
  const page = createEmptyPage(name, 'standard')
  page.slug = slugify(name); page.routePattern = `/${page.slug}`
  page.schema.root = [createNode('main', { meta: { sectionLabel: name }, styles: { desktop: { position: 'relative', minHeight: '82vh', padding: '110px 5vw', overflow: 'hidden', background: 'var(--site-bg)', color: 'var(--site-text)' }, mobile: { padding: '76px 20px' } }, children: [
    ambientFx(name === 'About' ? 181 : 191, .1),
    createNode('div', { styles: { desktop: { position: 'relative', zIndex: 2, width: 'min(1180px,100%)' } }, children: [
      contentNode('p', name.toUpperCase(), `${page.slug}.eyebrow`, `${name} Eyebrow`, { margin: 0, color: 'var(--site-accent)', fontSize: '11px', fontWeight: 800, letterSpacing: '.2em' }),
      contentNode('h1', name === 'About' ? 'Building systems with intent.' : 'Let’s start with the problem.', `${page.slug}.heading`, `${name} Heading`, { maxWidth: '960px', margin: '24px 0 0', fontSize: 'clamp(58px,9vw,126px)', lineHeight: '.87', letterSpacing: '-.075em' }, true),
      contentNode('p', `Edit this ${name.toLowerCase()} page from Admin Site Content or directly in Studio.`, `${page.slug}.body`, `${name} Body`, { maxWidth: '760px', margin: '34px 0 0', color: 'var(--site-muted)', fontSize: '20px', lineHeight: 1.75 }),
    ] }),
  ] })]
  return page
}

export function createAiAgePortfolioTemplate(): EditorDocument {
  const pages = [
    createAiAgeHeaderPage(),
    createAiAgeHomePage(),
    createCollectionIndexPage('Projects', 'projects', 'projects', 'title', 'short_description'),
    createDetailPage('Project Detail', 'projects', 'full_description'),
    createCollectionIndexPage('Notes', 'notes', 'notes', 'title', 'summary'),
    createDetailPage('Note Detail', 'notes', 'content'),
    createCollectionIndexPage('Apps', 'apps', 'apps', 'name', 'short_description'),
    createSimplePage('About'),
    createSimplePage('Contact'),
    createAiAgeFooterPage(),
  ]
  pages.forEach((page, index) => { if (page.pageType !== 'system') page.sortOrder = index })
  return {
    layoutId: null,
    layoutName: 'AI Age Portfolio',
    layoutSlug: 'ai-age-portfolio',
    layoutDescription: 'Futuristic cinematic portfolio with orbit systems, moving code, collection-driven work and a stateful capability console.',
    versionId: null,
    versionNumber: 1,
    versionStatus: 'draft',
    designTokens: {
      ...DEFAULT_DESIGN_TOKENS,
      variables: {
        '--site-bg': '#050507',
        '--site-surface': '#0b0b10',
        '--site-surface-2': '#111118',
        '--site-text': '#f4f5f7',
        '--site-muted': '#8a8d98',
        '--site-border': 'rgba(255,255,255,.12)',
        '--site-primary': '#9d7cff',
        '--site-accent': '#65f7e2',
        '--site-violet': '#9d7cff',
      },
      fonts: { heading: 'Inter, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      breakpoints: { desktop: 1440, tablet: 768, mobile: 375 },
    },
    pages,
  }
}
