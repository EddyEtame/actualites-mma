import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { modelJson, draftArticle, verifyCloud, writerEnvironment } from './cloud-news-edition.mjs';

const now='2026-10-07T18:00:00Z';
const passages=['The fighter confirmed he is interested in this MMA match.', 'The organization has not yet announced a confirmed date.'];
const candidate={title:'UFC fighter responds to challenge',source:'Source MMA',url:'https://mma.test/new-announcement',publishedAt:'2026-10-07T10:00:00Z',body:passages.join(' ')+' Reported news body with attribution.'};
const paragraph='Le combattant répond à cette proposition et précise que la rencontre reste une possibilité. Le média attribue cette déclaration à son entretien. Aucune affiche ne peut être considérée comme officielle à ce stade.';
const draft={title:'UFC : une réponse au défi',excerpt:'Une prise de parole ouvre une piste sans fixer de combat.',newsKey:'nouvelle-reponse-defi',kicker:'UFC · Déclaration',imageAlt:'',paragraphs:Array.from({length:5},(_,i)=>({heading:i?'Une déclaration attribuée':'',text:paragraph})),evidence:passages};
const approve={supported:true,newInformation:true,isMma:true,reasons:[]};
const completed=json=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(json)}]}]}));
const configured={OPENAI_API_KEY:'test-private-key',MMA_WRITER_MODEL:'explicit-model'};

test('unconfigured API key and model fail before any request',async()=>{
  let calls=0; const fetchImpl=async()=>{calls++;return new Response('{}');};
  await assert.rejects(modelJson({schema:{},name:'test',input:'',instructions:'',fetchImpl,environment:{}}),error=>error.code==='WRITER_NOT_CONFIGURED');
  await assert.rejects(modelJson({schema:{},name:'test',input:'',instructions:'',fetchImpl,environment:{OPENAI_API_KEY:'private'}}),error=>error.code==='WRITER_MODEL_NOT_CONFIGURED');
  assert.equal(calls,0);
});
test('committed writer model applies unless the repository variable overrides it',()=>{
  assert.equal(writerEnvironment({OPENAI_API_KEY:'key'},{writerModel:'committed-model'}).MMA_WRITER_MODEL,'committed-model');
  assert.equal(writerEnvironment({MMA_WRITER_MODEL:'override'},{writerModel:'committed-model'}).MMA_WRITER_MODEL,'override');
  assert.equal(writerEnvironment({MMA_WRITER_MODEL:''},{writerModel:'committed-model'}).MMA_WRITER_MODEL,'committed-model');
});
test('configured model is preserved; response uses strict schema and no storage',async()=>{
  let body;
  const result=await modelJson({schema:{type:'object'},name:'test',input:'source body',instructions:'Use only source',environment:configured,fetchImpl:async(_,options)=>{body=JSON.parse(options.body);return completed({ok:true});}});
  assert.equal(result.ok,true);assert.equal(body.model,'explicit-model');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
});
test('incomplete or refused provider output never becomes an article',async()=>{
  const options={schema:{},name:'test',input:'',instructions:'',environment:{OPENAI_API_KEY:'key',MMA_WRITER_MODEL:'model'}};
  await assert.rejects(modelJson({...options,fetchImpl:async()=>new Response(JSON.stringify({status:'incomplete',output:[]}))}),error=>error.code==='WRITER_INCOMPLETE');
  await assert.rejects(modelJson({...options,fetchImpl:async()=>new Response(JSON.stringify({status:'completed',output:[]}))}),error=>error.code==='WRITER_REFUSED');
});
test('transient provider failures are retried; a missing key or quota aborts at once',async()=>{
  const options={schema:{},name:'test',input:'',instructions:'',environment:configured,retryDelayMs:0};
  let calls=0;
  assert.deepEqual(await modelJson({...options,fetchImpl:async()=>++calls<3?new Response('{}',{status:503}):completed({ok:true})}),{ok:true});assert.equal(calls,3);
  calls=0;
  await assert.rejects(modelJson({...options,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({error:{code:'invalid_api_key'}}),{status:401});}}),error=>error.code==='WRITER_HTTP'&&error.details.fatal&&/invalid_api_key/.test(error.message));assert.equal(calls,1);
  calls=0;
  await assert.rejects(modelJson({...options,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({error:{code:'insufficient_quota'}}),{status:429});}}),error=>error.details.fatal);assert.equal(calls,1);
  calls=0;
  await assert.rejects(modelJson({...options,fetchImpl:async()=>{calls++;throw new TypeError('fetch failed');}}),error=>error.code==='WRITER_UNREACHABLE'&&error.details.fatal);assert.equal(calls,3);
});
test('fabricated evidence survives no revision and fails before review',async()=>{
  let calls=0;
  await assert.rejects(draftArticle(candidate,{now,model:async()=>{calls++;return {...draft,evidence:['This fabricated evidence does not appear in the source.',passages[1]]};}}),error=>error.code==='DRAFT_EVIDENCE');
  assert.equal(calls,2);
});
test('invented numeric details fail before review',async()=>{
  await assert.rejects(draftArticle(candidate,{now,model:async()=>({...draft,title:'Le combat du 17 octobre est fixé'})}),error=>error.code==='UNSUPPORTED_NUMBER');
});
test('typographic quoting of real source passages is accepted',async()=>{
  const curly={...candidate,body:candidate.body.replace('he is interested','he’s interested').replace('MMA match.','MMA « match ».')};
  let calls=0;
  const article=await draftArticle(curly,{now,model:async()=>++calls===1?{...draft,evidence:["The fighter confirmed he's interested in this MMA \"match\".",passages[1]]}:approve});
  assert.equal(calls,2);assert.equal(article.sourceEvidence.length,2);
});
test('a locally detected defect is revised once, then reviewed',async()=>{
  const names=[];
  const article=await draftArticle(candidate,{now,model:async request=>{names.push(request.name);
    if(request.name==='actu_mma_article')return {...draft,title:'Le combat du 17 octobre est fixé'};
    if(request.name==='actu_mma_article_revision'){assert.match(JSON.parse(request.input).problems[0],/17/);return draft;}
    return approve;}});
  assert.deepEqual(names,['actu_mma_article','actu_mma_article_revision','actu_mma_fact_review']);assert.equal(article.title,draft.title);
});
test('a sentence-like kicker is sent back for the "Organisation · Nature" format, and the writer knows the exact source name',async()=>{
  const requests=[];
  const article=await draftArticle(candidate,{now,model:async request=>{requests.push(request);
    if(request.name==='actu_mma_article')return {...draft,kicker:'Une occasion manquée'};
    if(request.name==='actu_mma_article_revision')return draft;
    return approve;}});
  assert.equal(JSON.parse(requests[0].input).sourceName,'Source MMA');
  assert.match(JSON.parse(requests[1].input).problems[0],/Organisation · Nature/);
  assert.equal(article.kicker,'UFC · Déclaration');assert.equal(article.author,'Rédaction PRISE MMA');
});
test('an unsupported fact flagged by the reviewer is revised and reviewed again',async()=>{
  const names=[];let reviews=0;
  const article=await draftArticle(candidate,{now,model:async request=>{names.push(request.name);
    if(request.name==='actu_mma_fact_review')return ++reviews===1?{supported:false,newInformation:true,isMma:true,reasons:['La date de contamination est inventée.']}:approve;
    if(request.name==='actu_mma_article_revision')assert.deepEqual(JSON.parse(request.input).problems,['La date de contamination est inventée.']);
    return draft;}});
  assert.deepEqual(names,['actu_mma_article','actu_mma_fact_review','actu_mma_article_revision','actu_mma_fact_review']);assert.equal(article.slug,'ufc-une-reponse-au-defi');
});
test('the address carries the headline without a date, and a repeated headline is numbered',async()=>{
  const model=async request=>request.name==='actu_mma_article'?draft:approve;
  assert.equal((await draftArticle(candidate,{now,model})).slug,'ufc-une-reponse-au-defi');
  const taken=[{slug:'ufc-une-reponse-au-defi'},{slug:'ufc-une-reponse-au-defi-2'}];
  assert.equal((await draftArticle(candidate,{now,model,existingCoverage:taken})).slug,'ufc-une-reponse-au-defi-3');
});
test('independent review receives prior source titles and rejects republished news without revision',async()=>{
  let reviewInput;let calls=0;
  await assert.rejects(draftArticle(candidate,{now,existingCoverage:[{title:'Ancien titre français',excerpt:'Même fait',newsKey:'same-fact',sources:[{title:'Original English title'}]}],model:async request=>{
    calls++;if(request.name==='actu_mma_article')return draft;
    reviewInput=JSON.parse(request.input);return {supported:true,newInformation:false,isMma:true,reasons:['Already covered']};
  }}),error=>error.code==='EDITORIAL_REJECTED');
  assert.equal(reviewInput.existingCoverage[0].sourceTitles[0],'Original English title');assert.equal(calls,2);
});
test('approved draft escapes HTML, keeps a translated photo description and retains immutable source metadata',async()=>{
  let calls=0;
  const article=await draftArticle(candidate,{now,sourceImageAlt:'The fighter at the weigh-in.',model:async request=>{++calls;if(calls===1){assert.equal(JSON.parse(request.input).sourceImageAlt,'The fighter at the weigh-in.');return {...draft,title:'UFC <titre> & défi',imageAlt:'Le combattant à la pesée.'};}return approve;}});
  assert.equal(calls,2);assert.equal(article.sources[0].publishedAt,candidate.publishedAt);assert.equal(article.sourcePublishedAt,candidate.publishedAt);assert.equal(article.sourceEvidence.length,2);assert.equal(article.publishedAt,now);
  assert.equal(article.imageAlt,'Le combattant à la pesée.');
  const silent=await draftArticle(candidate,{now,model:async request=>request.name==='actu_mma_article'?draft:approve});
  assert.equal('imageAlt' in silent,false);
});

test('the photo step downloads only the image when discovery already found its address',async t=>{
  const { default: sharp } = await import('sharp');
  const { sourcePhotograph } = await import('./news-image-fetch.mjs');
  const png=await sharp({create:{width:1600,height:900,channels:3,background:'#336699'}}).png().toBuffer();
  const original=globalThis.fetch;const requested=[];
  globalThis.fetch=async url=>{requested.push(String(url));return new Response(png,{status:200});};
  t.after(()=>{globalThis.fetch=original;});
  const photo=await sourcePhotograph({sources:[{url:'https://mma.test/news/story',name:'Source MMA',image:'https://cdn.mma.test/photo.png',imageAlt:'Le combattant à la pesée.'}]});
  assert.deepEqual(requested,['https://cdn.mma.test/photo.png']);
  assert.equal(photo.fields.imageSource.sourceImageAlt,'Le combattant à la pesée.');assert.equal(photo.fields.imageWidth,1200);assert.ok(photo.webp.length>0);
});

async function smokeFixture(t) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'actu-mma-cloud-smoke-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const articlesPath=path.join(directory,'articles.json');
  const articles=Array.from({length:6},(_,i)=>({
    slug:`published-${['a','b','c','d','e','f'][i]}`,title:`Sourced news ${i}`,excerpt:'A sourced factual news brief.',category:'actualites',content:['<p>A source-grounded article.</p>'],publishedAt:now,date:now.slice(0,10),publicationBatchId:now,sourcePublishedAt:candidate.publishedAt,
    sources:[{name:'Source MMA',title:candidate.title,url:`https://mma.test/story/${i}`,publishedAt:candidate.publishedAt,retrievedAt:now}],
    sourceEvidence:passages.map(excerpt=>({sourceUrl:`https://mma.test/story/${i}`,excerpt})),
    image:`/assets/editorial/story-${i}.webp`,imageAlt:'Published source photograph.',imageCredit:'Original photographer',imageSource:{pageUrl:`https://mma.test/story/${i}`},imageWidth:1200,imageHeight:675,
  }));
  await fs.writeFile(articlesPath,JSON.stringify(articles));
  return {articlesPath,publicRoot:directory,config:{batchSize:6},now,environment:configured,sourceReader:async()=>({publishedAt:candidate.publishedAt,body:candidate.body}),imageInspector:async()=>({width:1200,height:675,bytes:100_000}),
    discover:async()=>({feeds:[{name:'Source MMA',ok:true,discovered:9}],candidates:[candidate]}),photograph:async()=>({webp:Buffer.from('webp'),fields:{imageWidth:1200}})};
}
test('cloud smoke requires the key, and a model from the variable or the committed configuration',async()=>{
  await assert.rejects(verifyCloud({environment:{}}),error=>error.code==='WRITER_NOT_CONFIGURED');
  await assert.rejects(verifyCloud({environment:{OPENAI_API_KEY:'test'},config:{batchSize:6}}),error=>error.code==='WRITER_MODEL_NOT_CONFIGURED');
});
test('cloud smoke verifies six sources, photos, discovery and the photo pipeline with one small provider call and no article mutation',async t=>{
  const fixture=await smokeFixture(t);const original=await fs.readFile(fixture.articlesPath,'utf8');let requests=0;
  const result=await verifyCloud({...fixture,model:async request=>{requests++;assert.equal(request.maxOutputTokens,128);assert.equal(request.name,'actu_mma_cloud_smoke');return {answer:'OK'};}});
  assert.equal(requests,1);assert.equal(result.sources,6);assert.equal(result.photographs,6);assert.equal(result.freshCandidates,1);assert.equal(result.photographPipeline,'verified');assert.equal(result.published,0);
  assert.equal(await fs.readFile(fixture.articlesPath,'utf8'),original);
});
test('cloud smoke uses the committed model when no repository variable is set',async t=>{
  const fixture=await smokeFixture(t);let model;
  const result=await verifyCloud({...fixture,environment:{OPENAI_API_KEY:'key'},config:{batchSize:6,writerModel:'committed-model'},model:async request=>{model=request.environment.MMA_WRITER_MODEL;return {answer:'OK'};}});
  assert.equal(model,'committed-model');assert.equal(result.model,'committed-model');
});
test('cloud smoke rejects wrong photo sizes or absent evidence before calling provider',async t=>{
  const fixture=await smokeFixture(t);let requests=0;const model=async()=>{requests++;return {answer:'OK'};};
  await assert.rejects(verifyCloud({...fixture,model,imageInspector:async()=>({width:400,height:300,bytes:50_000})}),error=>error.code==='IMAGE_DIMENSIONS');
  await assert.rejects(verifyCloud({...fixture,model,sourceReader:async()=>({publishedAt:candidate.publishedAt,body:'No supporting passages here.'})}),error=>error.code==='UNSUPPORTED_EVIDENCE');
  await assert.rejects(verifyCloud({...fixture,model,photograph:async()=>({webp:Buffer.alloc(0),fields:{}})}),error=>error.code==='IMAGE_PIPELINE_FAILED');
  assert.equal(requests,0);
});
test('cloud smoke reports a revised source text without failing the pipeline',async t=>{
  const fixture=await smokeFixture(t);
  const articles=JSON.parse(await fs.readFile(fixture.articlesPath,'utf8')).map(article=>({...article,sourceEvidence:undefined,sources:article.sources.map(source=>({...source,bodyHash:'old'}))}));
  await fs.writeFile(fixture.articlesPath,JSON.stringify(articles));
  const result=await verifyCloud({...fixture,sourceReader:async()=>({publishedAt:candidate.publishedAt,body:candidate.body,bodyHash:'new'}),model:async()=>({answer:'OK'})});
  assert.equal(result.warnings.filter(warning=>/source text changed/.test(warning)).length,6);
});
test('a publisher refusing the server is reported, but a page that changed still fails',async t=>{
  const fixture=await smokeFixture(t);
  const refusal=Object.assign(new Error('Source mma.test responded HTTP 403.'),{code:'SOURCE_HTTP',details:{status:403}});
  const result=await verifyCloud({...fixture,sourceReader:async()=>{throw refusal;},model:async()=>({answer:'OK'}),
    discover:async()=>({feeds:[{name:'Source MMA',ok:true,discovered:9}],candidates:[candidate],rejected:[{url:'https://www.blocked.test/a',reason:'SOURCE_HTTP',detail:'Source blocked.test responded HTTP 403.'},{url:'https://blocked.test/b',reason:'SOURCE_HTTP',detail:'Source blocked.test responded HTTP 403.'},{url:'https://mma.test/old',reason:'STALE_OR_FUTURE_SOURCE',detail:'old'}]})});
  assert.equal(result.sources,0);assert.deepEqual(result.blockedHosts,{'blocked.test':2});
  assert.equal(result.warnings.filter(warning=>/refuses this server/.test(warning)).length,6);
  assert.ok(result.warnings.some(warning=>/blocked\.test refused 2/.test(warning)));assert.ok(result.warnings.some(warning=>/only 1\/6 fresh subjects/.test(warning)));
  const changed=Object.assign(new Error('No substantial article body extracted.'),{code:'MISSING_SOURCE_BODY'});
  await assert.rejects(verifyCloud({...fixture,sourceReader:async()=>{throw changed;},model:async()=>({answer:'OK'})}),error=>error.code==='MISSING_SOURCE_BODY');
});
test('cloud smoke fails an unexpected provider response without changing article bytes',async t=>{
  const fixture=await smokeFixture(t);const original=await fs.readFile(fixture.articlesPath,'utf8');
  await assert.rejects(verifyCloud({...fixture,model:async()=>({answer:'unexpected'})}),error=>error.code==='PROVIDER_SMOKE_FAILED');
  assert.equal(await fs.readFile(fixture.articlesPath,'utf8'),original);
});
