import test from 'node:test'
import assert from 'node:assert/strict'
import { createBlankDocument, createNode, cloneNodeWithFreshIds, findNodeById, isDescendant } from '../packages/builder-core/src/editor-state'
import { createCosmicPortfolioTemplate } from '../packages/builder-core/src/templates'
import { collectContentSlots, buildContentCompatibility, isRuntimeCompatible, validateEditorDocument, validateReleaseCandidate } from '../packages/validation/src/index'
import { applyCollectionQuery, renderNodeToHtml, resolveBinding, resolveResponsiveStyles } from '../packages/runtime-renderer/src/index'
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

test('Blank and Cosmic starters provide deterministic base slugs and valid initial pages',()=>{const blank=createBlankDocument('RG2 Integration Test');const cosmic=createCosmicPortfolioTemplate();assert.equal(blank.layoutSlug,'rg2-integration-test');assert.equal(blank.pages.length,3);assert.equal(cosmic.layoutSlug,'cosmic-portfolio');assert.ok(cosmic.pages.length>0);assert.equal(validateEditorDocument(blank).valid,true);assert.equal(validateEditorDocument(cosmic).valid,true)})

test('runtime static HTML renderer preserves node structure',()=>{const node=createNode('h1',{bindings:{text:{type:'content',key:'home.hero.heading',sample:'Hero Heading'}},styles:{desktop:{fontSize:'72px'}}});const html=renderNodeToHtml(node);assert.match(html,/Hero Heading/);assert.match(html,/font-size:72px/)})

test('only production-supported animation names are exposed',()=>{for(const name of ['fade','fade-up','float','spin','orbit','typewriter','glitch','tilt-3d','scale-hover','aurora','parallax-y'])assert.equal(isAnimationSupported(name),true);assert.equal(isAnimationSupported('made-up-animation'),false)})


test('runtime compatibility blocks layouts that require a newer runtime',()=>{assert.equal(isRuntimeCompatible('1.0.0','1.0.0'),true);assert.equal(isRuntimeCompatible('1.1.0','1.0.0'),false);const result=validateEditorDocument(createCosmicPortfolioTemplate(),{runtimeVersion:'1.0.0',runtimeMinVersion:'2.0.0'});assert.ok(result.errors.some(e=>e.code==='runtime.incompatible'))})

test('conflicting content key types are rejected before slot dedupe',()=>{const doc=createCosmicPortfolioTemplate();const home=doc.pages.find(p=>p.pageType==='home')!;home.schema.root.push(createNode('p',{bindings:{text:{type:'content',key:'home.hero.heading',label:'Conflict',contentType:'number',sample:1}},styles:{desktop:{}}}));const result=validateEditorDocument(doc);assert.ok(result.errors.some(e=>e.code==='content.type-conflict'))})

test('animation trigger compatibility is validated against the runtime registry',()=>{const doc=createCosmicPortfolioTemplate();const home=doc.pages.find(p=>p.pageType==='home')!;home.schema.root.push(createNode('div',{animation:{type:'spin',trigger:'hover',duration:500,easing:'linear'},styles:{desktop:{}}}));const result=validateEditorDocument(doc);assert.ok(result.errors.some(e=>e.code==='animation.trigger-unsupported'))})

test('release validation checks typed content and stable media ids',()=>{const doc=createCosmicPortfolioTemplate();const home=doc.pages.find(p=>p.pageType==='home')!;home.schema.root.push(createNode('img',{bindings:{src:{type:'content',key:'home.hero.photo',label:'Hero photo',contentType:'media',required:true,sample:'sample.jpg'}},styles:{desktop:{}}}));const result=validateReleaseCandidate(doc,{'home.hero.heading':'Hello','home.hero.description':'Description','home.hero.photo':'missing-media-id'},{mediaIds:new Set(),settings:{},collections:{projects:[],notes:[],experience:[],apps:[]}});assert.ok(result.errors.some(e=>e.code==='content.media-missing'))})


test('button content binding maps one Admin value to text and href properties',()=>{const binding:any={type:'content',key:'home.hero.cta',label:'Primary CTA',contentType:'button',sample:{label:'Explore',href:'/projects'}};const ctx:any={content:{'home.hero.cta':{label:'My Work',href:'/projects'}}};assert.equal(resolveBinding(binding,'text',ctx),'My Work');assert.equal(resolveBinding(binding,'href',ctx),'/projects')})
