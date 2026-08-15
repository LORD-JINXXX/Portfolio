import test from 'node:test'
import assert from 'node:assert/strict'
import { createBlankDocument, createNode, cloneNodeWithFreshIds, findNodeById, isDescendant } from '../packages/builder-core/src/editor-state'
import { createCosmicPortfolioTemplate } from '../packages/builder-core/src/templates'
import { createAiAgePortfolioTemplate } from '../packages/builder-core/src/ai-age-template'
import { createCinematicTransitionPortfolioTemplate } from '../packages/builder-core/src/cinematic-transition-template'
import { collectContentSlots, buildContentCompatibility, isRuntimeCompatible, validateEditorDocument, validateReleaseCandidate } from '../packages/validation/src/index'
import { applyCollectionQuery, computeSceneTransitionState, renderNodeToHtml, resolveBinding, resolveResponsiveStyles } from '../packages/runtime-renderer/src/index'
import { isAnimationSupported } from '../packages/animation-runtime/src/index'

test('recursive duplication assigns fresh ids to every descendant', () => {
  const original=createNode('section',{children:[createNode('div',{children:[createNode('p')]})]})
  const clone=cloneNodeWithFreshIds(original)
  const ids=(n:any):string[]=>[n.id,...(n.children||[]).flatMap(ids)]
  const a=ids(original),b=ids(clone)
  assert.equal(a.length,b.length);for(const id of b)assert.equal(a.includes(id),false)
})

test('tree cycle detection finds descendants',()=>{const child=createNode('div'),root=createNode('section',{children:[child]});assert.equal(isDescendant([root],root.id,child.id),true);assert.equal(isDescendant([root],child.id,root.id),false);assert.equal(findNodeById([root],child.id)?.id,child.id)})

test('responsive styles inherit desktop then tablet then mobile',()=>{const styles={desktop:{color:'white',fontSize:'60px'},tablet:{fontSize:'44px'},mobile:{fontSize:'32px'}};assert.deepEqual(resolveResponsiveStyles(styles,'mobile'),{color:'white',fontSize:'32px'});assert.deepEqual(resolveResponsiveStyles(styles,'tablet'),{color:'white',fontSize:'44px'})})

test('collection query filters sorts and limits',()=>{const items=[{id:1,featured:true,display_order:2},{id:2,featured:false,display_order:1},{id:3,featured:true,display_order:1}];const got=applyCollectionQuery(items,{type:'collection',collection:'projects',filters:[{field:'featured',operator:'eq',value:true}],sort:[{field:'display_order',direction:'asc'}],limit:1});assert.equal((got[0] as any).id,3)})

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
