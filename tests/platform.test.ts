import test from 'node:test'
import assert from 'node:assert/strict'
import { createBlankDocument, createNode, cloneNodeWithFreshIds, findNodeById, isDescendant } from '../packages/builder-core/src/editor-state'
import { createCosmicPortfolioTemplate } from '../packages/builder-core/src/templates'
import { createAiAgePortfolioTemplate } from '../packages/builder-core/src/ai-age-template'
import { createCinematicTransitionPortfolioTemplate } from '../packages/builder-core/src/cinematic-transition-template'
import { collectContentSlots, buildContentCompatibility, isRuntimeCompatible, validateEditorDocument, validateReleaseCandidate } from '../packages/validation/src/index'
import { applyCollectionQuery, computeNodeStyle, computeSceneTransitionState, getRuntimeRouteFieldContext, renderNodeToHtml, resolveBinding, resolveCollectionBindingItems, resolveResponsiveStyles, resolveRuntimeViewportCssValue, sanitizeRuntimeStyle } from '../packages/runtime-renderer/src/index'
import { DesignTokensSchema, DEFAULT_DESIGN_TOKENS, ScrollBehaviorSchema, isSafeCssCustomPropertyName, isSafeRuntimeStyleProperty, resolvePreviewWidth, resolveReducedMotionScrollFallback, resolveResponsiveLayout, resolveResponsiveMode, resolveResponsiveScrollMode } from '../packages/contracts/src/index'
import { CSS_SPRING_EASING, isAnimationSupported, normalizeCssEasing } from '../packages/animation-runtime/src/index'

test('recursive duplication assigns fresh ids to every descendant', () => {
  const original=createNode('section',{children:[createNode('div',{children:[createNode('p')]})]})
  const clone=cloneNodeWithFreshIds(original)
  const ids=(n:any):string[]=>[n.id,...(n.children||[]).flatMap(ids)]
  const a=ids(original),b=ids(clone)
  assert.equal(a.length,b.length);for(const id of b)assert.equal(a.includes(id),false)
})

test('tree cycle detection finds descendants',()=>{const child=createNode('div'),root=createNode('section',{children:[child]});assert.equal(isDescendant([root],root.id,child.id),true);assert.equal(isDescendant([root],child.id,root.id),false);assert.equal(findNodeById([root],child.id)?.id,child.id)})

test('responsive styles inherit desktop then tablet then mobile',()=>{const styles={desktop:{color:'white',fontSize:'60px'},tablet:{fontSize:'44px'},mobile:{fontSize:'32px'}};assert.deepEqual(resolveResponsiveStyles(styles,'mobile'),{color:'white',fontSize:'32px'});assert.deepEqual(resolveResponsiveStyles(styles,'tablet'),{color:'white',fontSize:'44px'})})

test('CSS animation safety maps spring and rejects meta style properties',()=>{
  assert.equal(normalizeCssEasing('spring'),CSS_SPRING_EASING)
  assert.equal(normalizeCssEasing('cubic-bezier(.2,.8,.2,1)'),'cubic-bezier(.2,.8,.2,1)')
  assert.equal(isSafeRuntimeStyleProperty('backgroundImage'),true)
  assert.equal(isSafeRuntimeStyleProperty('WebkitMaskImage'),true)
  assert.equal(isSafeRuntimeStyleProperty('--glow-color'),true)
  assert.equal(isSafeRuntimeStyleProperty('cssText'),false)
  assert.equal(isSafeRuntimeStyleProperty('__proto__'),false)
  assert.equal(isSafeCssCustomPropertyName('--angle'),true)
  assert.equal(isSafeCssCustomPropertyName('angle'),false)
})

test('runtime style sanitizer keeps safe custom properties and drops unsafe property names',()=>{
  const style=sanitizeRuntimeStyle({backgroundImage:'repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 10px)','--angle':'45deg',cssText:'color:red'} as any) as any
  assert.equal(style.backgroundImage,'repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 10px)')
  assert.equal(style['--angle'],'45deg')
  assert.equal(style.cssText,undefined)
})

test('responsive runtime thresholds are independent from Studio preview widths',()=>{
  assert.equal(resolvePreviewWidth(DEFAULT_DESIGN_TOKENS,'mobile'),375)
  assert.equal(resolvePreviewWidth(DEFAULT_DESIGN_TOKENS,'tablet'),768)
  assert.equal(resolveResponsiveMode(390,DEFAULT_DESIGN_TOKENS),'mobile')
  assert.equal(resolveResponsiveMode(767,DEFAULT_DESIGN_TOKENS),'mobile')
  assert.equal(resolveResponsiveMode(768,DEFAULT_DESIGN_TOKENS),'tablet')
  assert.equal(resolveResponsiveMode(1023,DEFAULT_DESIGN_TOKENS),'tablet')
  assert.equal(resolveResponsiveMode(1024,DEFAULT_DESIGN_TOKENS),'desktop')
  const custom={...DEFAULT_DESIGN_TOKENS,breakpoints:{desktop:1600,tablet:900,mobile:420,mobileMax:639,tabletMax:959}}
  assert.equal(resolvePreviewWidth(custom,'mobile'),420)
  assert.equal(resolveResponsiveMode(640,custom),'tablet')
  assert.equal(resolveResponsiveMode(960,custom),'desktop')
})

test('responsive absolute layout geometry inherits and can return to flow without changing desktop',()=>{
  const layout={mode:'absolute' as const,x:100,y:80,width:600,height:320,rotation:2,zIndex:4,tablet:{x:48,width:520},mobile:{mode:'flow' as const,rotation:0}}
  assert.deepEqual(resolveResponsiveLayout(layout,'desktop'),{mode:'absolute',x:100,y:80,width:600,height:320,rotation:2,zIndex:4})
  assert.deepEqual(resolveResponsiveLayout(layout,'tablet'),{mode:'absolute',x:48,y:80,width:520,height:320,rotation:2,zIndex:4})
  assert.deepEqual(resolveResponsiveLayout(layout,'mobile'),{mode:'flow',x:48,y:80,width:520,height:320,rotation:0,zIndex:4})
  const node=createNode('div',{layout,styles:{desktop:{color:'white'},mobile:{color:'black'}}})
  const desktop=computeNodeStyle(node,'desktop'),tablet=computeNodeStyle(node,'tablet'),mobile=computeNodeStyle(node,'mobile')
  assert.equal(desktop.position,'absolute');assert.equal(desktop.left,100);assert.equal(desktop.width,600)
  assert.equal(tablet.position,'absolute');assert.equal(tablet.left,48);assert.equal(tablet.width,520)
  assert.equal(mobile.position,undefined);assert.equal(mobile.left,undefined);assert.equal(mobile.width,undefined);assert.equal(mobile.color,'black')
})

test('design token breakpoint validation rejects unreachable or unordered modes',()=>{
  assert.equal(DesignTokensSchema.safeParse(DEFAULT_DESIGN_TOKENS).success,true)
  assert.equal(DesignTokensSchema.safeParse({...DEFAULT_DESIGN_TOKENS,breakpoints:{desktop:700,tablet:768,mobile:375,mobileMax:767,tabletMax:1023}}).success,false)
  assert.equal(DesignTokensSchema.safeParse({...DEFAULT_DESIGN_TOKENS,breakpoints:{desktop:1440,tablet:768,mobile:375,mobileMax:1024,tabletMax:900}}).success,false)
})

test('scroll behavior inherits Desktop to Tablet to Mobile with explicit responsive overrides',()=>{
  const behavior={mode:'card-deck' as const,tabletFallback:'sticky' as const,mobileFallback:'normal' as const,reducedMotionFallback:'reduce' as const}
  assert.equal(resolveResponsiveScrollMode(behavior,'desktop'),'card-deck')
  assert.equal(resolveResponsiveScrollMode(behavior,'tablet'),'sticky')
  assert.equal(resolveResponsiveScrollMode(behavior,'mobile'),'normal')
  const inherited={mode:'parallax' as const,tabletFallback:'reveal' as const}
  assert.equal(resolveResponsiveScrollMode(inherited,'mobile'),'reveal')
  assert.equal(resolveResponsiveScrollMode(undefined,'mobile'),'normal')
  assert.equal(ScrollBehaviorSchema.safeParse(behavior).success,true)
  assert.equal(resolveReducedMotionScrollFallback(undefined),'reduce')
  assert.equal(resolveReducedMotionScrollFallback({mode:'card-deck',reducedMotionFallback:'none'}),'none')
})

test('responsive scroll mode changes structural runtime styles without changing authored base behavior',()=>{
  const node=createNode('div',{scrollBehavior:{mode:'sticky',tabletFallback:'horizontal',mobileFallback:'normal',stickyTop:24},styles:{desktop:{display:'grid',color:'white'}}})
  const desktop=computeNodeStyle(node,'desktop')
  const tablet=computeNodeStyle(node,'tablet')
  const mobile=computeNodeStyle(node,'mobile')
  assert.equal(desktop.position,'sticky');assert.equal(desktop.top,24)
  assert.equal(tablet.display,'flex');assert.equal(tablet.flexDirection,'row');assert.equal(tablet.overflowX,'auto')
  assert.equal(mobile.position,undefined);assert.equal(mobile.display,'grid')
  assert.equal(node.scrollBehavior?.mode,'sticky')
})

test('Studio simulated viewport units resolve against the selected frame without changing public CSS values',()=>{
  const viewport={width:375,height:812}
  assert.equal(resolveRuntimeViewportCssValue('100vw',viewport),'375px')
  assert.equal(resolveRuntimeViewportCssValue('100dvh',viewport),'812px')
  assert.equal(resolveRuntimeViewportCssValue('clamp(16px, 10vw, 64px)',viewport),'clamp(16px, 37.5px, 64px)')
  assert.equal(resolveRuntimeViewportCssValue('calc(100vh - 32px)',viewport),'calc(812px - 32px)')
  assert.equal(resolveRuntimeViewportCssValue('50vmin',viewport),'187.5px')
  assert.equal(resolveRuntimeViewportCssValue('url("https://example.com/100vw.png") 10vw',viewport),'url("https://example.com/100vw.png") 37.5px')
  assert.equal(resolveRuntimeViewportCssValue('100vw',undefined),'100vw')
})

test('Studio editor environment keeps authored responsive styles but neutralizes structural sticky geometry',()=>{
  const node=createNode('div',{scrollBehavior:{mode:'sticky',stickyTop:40},styles:{desktop:{width:'100vw',height:'100vh',color:'white'}}})
  const runtime=computeNodeStyle(node,'desktop',{viewportSize:{width:1440,height:900},environment:'runtime'})
  const editor=computeNodeStyle(node,'desktop',{viewportSize:{width:1440,height:900},environment:'editor'})
  assert.equal(runtime.position,'sticky');assert.equal(runtime.top,40)
  assert.equal(editor.position,undefined);assert.equal(editor.top,undefined)
  assert.equal(editor.width,'1440px');assert.equal(editor.height,'900px');assert.equal(editor.color,'white')
})

test('collection query filters sorts and limits',()=>{const items=[{id:1,featured:true,display_order:2},{id:2,featured:false,display_order:1},{id:3,featured:true,display_order:1}];const got=applyCollectionQuery(items,{type:'collection',collection:'projects',filters:[{field:'featured',operator:'eq',value:true}],sort:[{field:'display_order',direction:'asc'}],limit:1});assert.equal((got[0] as any).id,3)})


test('current item array repeat resolves object and primitive arrays from scoped field contexts',()=>{
  const root={slug:'visualbuild',gallery_media:[{media_id:'m1',sort_order:0},{media_id:'m2',sort_order:1}],technologies:['React','TypeScript']}
  const projectDetails={blocks:[{heading:'Why',block_type:'rich_text'},{heading:'Architecture',block_type:'architecture'}]}
  const ctx:any={fieldContext:projectDetails,parentFieldContext:root,rootFieldContext:root}
  const blocks=resolveCollectionBindingItems({type:'collection',source:'current-item-array',field:'blocks'},ctx)
  assert.deepEqual(blocks,[{heading:'Why',block_type:'rich_text'},{heading:'Architecture',block_type:'architecture'}])
  const gallery=resolveCollectionBindingItems({type:'collection',source:'current-item-array',field:'gallery_media',fieldScope:'root'},ctx)
  assert.deepEqual(gallery,[{media_id:'m1',sort_order:0},{media_id:'m2',sort_order:1}])
  const technologies=resolveCollectionBindingItems({type:'collection',source:'current-item-array',field:'technologies',fieldScope:'root'},ctx)
  assert.deepEqual(technologies,[{value:'React'},{value:'TypeScript'}])
})

test('field bindings can address current parent and root repeated-item contexts',()=>{
  const ctx:any={fieldContext:{heading:'Block'},parentFieldContext:{name:'Project Details'},rootFieldContext:{title:'VisualBuild',slug:'visualbuild'},media:{m1:{id:'m1',url:'https://cdn.example/m1.png'}}}
  assert.equal(resolveBinding({type:'field',field:'heading'},'text',ctx),'Block')
  assert.equal(resolveBinding({type:'field',field:'name',scope:'parent'},'text',ctx),'Project Details')
  assert.equal(resolveBinding({type:'field',field:'title',scope:'root'},'text',ctx),'VisualBuild')
})

test('runtime detail route field context resolves the requested slug instead of the first record',()=>{
  const manifest:any={collections:{projects:[{id:'1',slug:'alpha',title:'Alpha'},{id:'2',slug:'visualbuild',title:'VisualBuild'}]}}
  const route:any={pageType:'collection_detail',collectionName:'projects'}
  assert.equal(getRuntimeRouteFieldContext(manifest,route,{slug:'visualbuild'})?.title,'VisualBuild')
  assert.equal(getRuntimeRouteFieldContext(manifest,route,{slug:'missing'}),undefined)
})

test('Current Item Array collection bindings validate their array field requirement',()=>{
  const doc=createBlankDocument()
  const page=doc.pages[0]
  page.schema.root=[createNode('collection',{bindings:{items:{type:'collection',source:'current-item-array',field:'blocks'}}})]
  assert.equal(validateEditorDocument(doc).valid,true)
  page.schema.root=[createNode('collection',{bindings:{items:{type:'collection',source:'current-item-array'} as any}})]
  assert.ok(validateEditorDocument(doc).errors.some(error=>error.code==='binding.collection.array-field'))
})

test('content registry extracts slots and compatibility',()=>{const doc=createCosmicPortfolioTemplate();const slots=collectContentSlots(doc);assert.ok(slots.some(s=>s.key==='home.hero.heading'));const compatibility=buildContentCompatibility(doc,{'home.hero.heading':'Hi'});assert.ok(compatibility.missingRequired.some(s=>s.key==='home.hero.description'));assert.ok(compatibility.resolved.includes('home.hero.heading'))})

test('Cosmic starter validates with generic scroll and bindings',()=>{const result=validateEditorDocument(createCosmicPortfolioTemplate());assert.equal(result.errors.length,0,JSON.stringify(result.errors,null,2));assert.equal(result.valid,true)})

test('AI Age starter is a valid editable multi-page Studio document',()=>{const document=createAiAgePortfolioTemplate();const result=validateEditorDocument(document);assert.equal(result.errors.length,0,JSON.stringify(result.errors,null,2));assert.equal(result.valid,true);assert.equal(document.layoutSlug,'ai-age-portfolio');assert.equal(document.pages.length,10);assert.ok(collectContentSlots(document).some(slot=>slot.key==='home.hero.heading'));const home=document.pages.find(page=>page.pageType==='home')!;assert.deepEqual(home.schema.initialState?.['tech.category'],'frontend')})

test('Cinematic Transition starter is a valid editable multi-page Studio document',()=>{const document=createCinematicTransitionPortfolioTemplate();const result=validateEditorDocument(document);assert.equal(result.errors.length,0,JSON.stringify(result.errors,null,2));assert.equal(result.valid,true);assert.equal(document.layoutSlug,'cinematic-transition-portfolio');assert.equal(document.pages.length,9);assert.ok(collectContentSlots(document).some(slot=>slot.key==='home.intro.video'));const home=document.pages.find(page=>page.pageType==='home')!;assert.equal(home.schema.root[0]?.type,'intro-sequence');const sequence=home.schema.root[1];assert.equal(sequence?.type,'cinematic-sequence');assert.equal(sequence?.children?.filter(node=>node.type==='scene-frame').length,6);assert.equal(sequence?.props?.bridgeText,'COMING UP NEXT');assert.deepEqual(home.schema.initialState?.['tech.category'],'frontend')})

test('scene transition progress is deterministic and reversible',()=>{const params={enterFrom:'top',exitTo:'right',entryEffect:'slide',bridgeEnd:10,enterEnd:30,exitStart:68,exitEnd:100,distance:100};const start=computeSceneTransitionState(0,params,1200,800);const entered=computeSceneTransitionState(.3,params,1200,800);const dwell=computeSceneTransitionState(.5,params,1200,800);const exit=computeSceneTransitionState(1,params,1200,800);assert.equal(start.y,-800);assert.deepEqual([entered.x,entered.y],[0,0]);assert.deepEqual([dwell.x,dwell.y],[0,0]);assert.equal(exit.x,1200);assert.deepEqual(computeSceneTransitionState(.3,params,1200,800),entered);const wipe=computeSceneTransitionState(.1,{...params,enterFrom:'left',entryEffect:'wipe'},1200,800);assert.equal(wipe.clipRight,100);assert.equal(wipe.x,0);const finale=computeSceneTransitionState(1,{...params,finalScene:true,skipEntry:true},1200,800);assert.deepEqual([finale.x,finale.y],[0,0])})

test('all starters provide deterministic base slugs and valid initial pages',()=>{const blank=createBlankDocument('RG2 Integration Test');const cosmic=createCosmicPortfolioTemplate();const aiAge=createAiAgePortfolioTemplate();const cinematic=createCinematicTransitionPortfolioTemplate();assert.equal(blank.layoutSlug,'rg2-integration-test');assert.equal(blank.pages.length,3);assert.equal(cosmic.layoutSlug,'cosmic-portfolio');assert.equal(aiAge.layoutSlug,'ai-age-portfolio');assert.equal(cinematic.layoutSlug,'cinematic-transition-portfolio');for(const document of [blank,cosmic,aiAge,cinematic])assert.equal(validateEditorDocument(document).valid,true)})

test('runtime static HTML renderer preserves node structure',()=>{const node=createNode('h1',{bindings:{text:{type:'content',key:'home.hero.heading',sample:'Hero Heading'}},styles:{desktop:{fontSize:'72px'}}});const html=renderNodeToHtml(node);assert.match(html,/Hero Heading/);assert.match(html,/font-size:72px/)})

test('only production-supported animation names are exposed',()=>{for(const name of ['fade','fade-up','float','spin','orbit','typewriter','glitch','tilt-3d','scale-hover','aurora','parallax-y'])assert.equal(isAnimationSupported(name),true);assert.equal(isAnimationSupported('made-up-animation'),false)})


test('runtime compatibility blocks layouts that require a newer runtime',()=>{assert.equal(isRuntimeCompatible('1.0.0','1.0.0'),true);assert.equal(isRuntimeCompatible('1.1.0','1.0.0'),false);const result=validateEditorDocument(createCosmicPortfolioTemplate(),{runtimeVersion:'1.0.0',runtimeMinVersion:'2.0.0'});assert.ok(result.errors.some(e=>e.code==='runtime.incompatible'))})

test('conflicting content key types are rejected before slot dedupe',()=>{const doc=createCosmicPortfolioTemplate();const home=doc.pages.find(p=>p.pageType==='home')!;home.schema.root.push(createNode('p',{bindings:{text:{type:'content',key:'home.hero.heading',label:'Conflict',contentType:'number',sample:1}},styles:{desktop:{}}}));const result=validateEditorDocument(doc);assert.ok(result.errors.some(e=>e.code==='content.type-conflict'))})

test('animation trigger compatibility is validated against the runtime registry',()=>{const doc=createCosmicPortfolioTemplate();const home=doc.pages.find(p=>p.pageType==='home')!;home.schema.root.push(createNode('div',{animation:{type:'spin',trigger:'hover',duration:500,easing:'linear'},styles:{desktop:{}}}));const result=validateEditorDocument(doc);assert.ok(result.errors.some(e=>e.code==='animation.trigger-unsupported'))})

test('release validation checks typed content and stable media ids',()=>{const doc=createCosmicPortfolioTemplate();const home=doc.pages.find(p=>p.pageType==='home')!;home.schema.root.push(createNode('img',{bindings:{src:{type:'content',key:'home.hero.photo',label:'Hero photo',contentType:'media',required:true,sample:'sample.jpg'}},styles:{desktop:{}}}));const result=validateReleaseCandidate(doc,{'home.hero.heading':'Hello','home.hero.description':'Description','home.hero.photo':'missing-media-id'},{mediaIds:new Set(),settings:{},collections:{projects:[],notes:[],experience:[],apps:[]}});assert.ok(result.errors.some(e=>e.code==='content.media-missing'))})


test('button content binding maps one Admin value to text and href properties',()=>{const binding:any={type:'content',key:'home.hero.cta',label:'Primary CTA',contentType:'button',sample:{label:'Explore',href:'/projects'}};const ctx:any={content:{'home.hero.cta':{label:'My Work',href:'/projects'}}};assert.equal(resolveBinding(binding,'text',ctx),'My Work');assert.equal(resolveBinding(binding,'href',ctx),'/projects')})
