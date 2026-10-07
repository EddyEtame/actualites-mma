import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { modelJson, draftArticle, verifyCloud } from './cloud-news-edition.mjs';

const now='2026-10-07T18:00:00Z';
const passages=['The fighter confirmed he is interested in this MMA match.', 'The organization has not yet announced a confirmed date.'];
const candidate={title:'UFC fighter responds to challenge',source:'Source MMA',url:'https://mma.test/new-announcement',publishedAt:'2026-10-07T10:00:00Z',body:passages.join(' ')+' Reported news body with attribution.'};
const paragraph='Le combattant répond à cette proposition et précise que la rencontre reste une possibilité. Le média attribue cette déclaration à son entretien. Aucune affiche ne peut être considérée comme officielle à ce stade.';
const draft={title:'UFC : une réponse au défi',excerpt:'Une prise de parole ouvre une piste sans fixer de combat.',newsKey:'nouvelle-reponse-defi',kicker:'UFC · Déclaration',paragraphs:Array.from({length:5},(_,i)=>({heading:i?'Une déclaration attribuée':'',text:paragraph})),evidence:passages};

test('unconfigured API key and model fail before any request',async()=>{
  let calls=0; const fetchImpl=async()=>{calls++;return new Response('{}');};
  await assert.rejects(modelJson({schema:{},name:'test',input:'',instructions:'',fetchImpl,environment:{}}),error=>error.code==='WRITER_NOT_CONFIGURED');
  await assert.rejects(modelJson({schema:{},name:'test',input:'',instructions:'',fetchImpl,environment:{OPENAI_API_KEY:'private'}}),error=>error.code==='WRITER_MODEL_NOT_CONFIGURED');
  assert.equal(calls,0);
});
test('configured model is preserved; response uses strict schema and no storage',async()=>{
  let body;
  const result=await modelJson({schema:{type:'object'},name:'test',input:'source body',instructions:'Use only source',environment:{OPENAI_API_KEY:'test-private-key',MMA_WRITER_MODEL:'explicit-model'},fetchImpl:async(_,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'{"ok":true}'}]}]}));}});
  assert.equal(result.ok,true);assert.equal(body.model,'explicit-model');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
});
test('incomplete or refused provider output never becomes an article',async()=>{
  const options={schema:{},name:'test',input:'',instructions:'',environment:{OPENAI_API_KEY:'key',MMA_WRITER_MODEL:'model'}};
  await assert.rejects(modelJson({...options,fetchImpl:async()=>new Response(JSON.stringify({status:'incomplete',output:[]}))}),error=>error.code==='WRITER_INCOMPLETE');
  await assert.rejects(modelJson({...options,fetchImpl:async()=>new Response(JSON.stringify({status:'completed',output:[]}))}),error=>error.code==='WRITER_REFUSED');
});
test('fabricated evidence fails before review',async()=>{
  await assert.rejects(draftArticle(candidate,{now,model:async()=>({...draft,evidence:['This fabricated evidence does not appear in the source.',passages[1]]})}),error=>error.code==='DRAFT_EVIDENCE');
});
test('invented numeric details fail before review',async()=>{
  await assert.rejects(draftArticle(candidate,{now,model:async()=>({...draft,title:'Le combat du 17 octobre est fixé'})}),error=>error.code==='UNSUPPORTED_NUMBER');
});
test('independent review receives prior source titles and rejects republished news',async()=>{
  let reviewInput;
  await assert.rejects(draftArticle(candidate,{now,existingCoverage:[{title:'Ancien titre français',excerpt:'Même fait',newsKey:'same-fact',sources:[{title:'Original English title'}]}],model:async request=>{
    if(request.name==='actu_mma_article')return draft;
    reviewInput=JSON.parse(request.input);return {supported:true,newInformation:false,isMma:true,reasons:['Already covered']};
  }}),error=>error.code==='EDITORIAL_REJECTED');
  assert.equal(reviewInput.existingCoverage[0].sourceTitles[0],'Original English title');
});
test('approved draft escapes HTML and retains immutable source metadata',async()=>{
  let calls=0;
  const article=await draftArticle(candidate,{now,model:async()=>++calls===1?{...draft,title:'UFC <titre> & défi'}:{supported:true,newInformation:true,isMma:true,reasons:[]}});
  assert.equal(calls,2);assert.equal(article.sources[0].publishedAt,candidate.publishedAt);assert.equal(article.sourcePublishedAt,candidate.publishedAt);assert.equal(article.sourceEvidence.length,2);assert.equal(article.publishedAt,now);
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
  return {articlesPath,publicRoot:directory,config:{batchSize:6},now,environment:{OPENAI_API_KEY:'private-test',MMA_WRITER_MODEL:'explicit-model'},sourceReader:async()=>({publishedAt:candidate.publishedAt,body:candidate.body}),imageInspector:async()=>({width:1200,height:675,bytes:100_000})};
}
test('cloud smoke requires both credentials even when scheduled publication is not due',async()=>{
  await assert.rejects(verifyCloud({environment:{}}),error=>error.code==='WRITER_NOT_CONFIGURED');
  await assert.rejects(verifyCloud({environment:{OPENAI_API_KEY:'test'}}),error=>error.code==='WRITER_MODEL_NOT_CONFIGURED');
});
test('cloud smoke verifies all six sources and photos with one small provider call and no article mutation',async t=>{
  const fixture=await smokeFixture(t);const original=await fs.readFile(fixture.articlesPath,'utf8');let requests=0;
  const result=await verifyCloud({...fixture,model:async request=>{requests++;assert.equal(request.maxOutputTokens,128);assert.equal(request.name,'actu_mma_cloud_smoke');return {answer:'OK'};}});
  assert.equal(requests,1);assert.equal(result.sources,6);assert.equal(result.photographs,6);assert.equal(result.published,0);
  assert.equal(await fs.readFile(fixture.articlesPath,'utf8'),original);
});
test('cloud smoke rejects wrong photo sizes or absent evidence before calling provider',async t=>{
  const fixture=await smokeFixture(t);let requests=0;const model=async()=>{requests++;return {answer:'OK'};};
  await assert.rejects(verifyCloud({...fixture,model,imageInspector:async()=>({width:400,height:300,bytes:50_000})}),error=>error.code==='IMAGE_DIMENSIONS');
  await assert.rejects(verifyCloud({...fixture,model,sourceReader:async()=>({publishedAt:candidate.publishedAt,body:'No supporting passages here.'})}),error=>error.code==='UNSUPPORTED_EVIDENCE');
  assert.equal(requests,0);
});
test('cloud smoke fails an unexpected provider response without changing article bytes',async t=>{
  const fixture=await smokeFixture(t);const original=await fs.readFile(fixture.articlesPath,'utf8');
  await assert.rejects(verifyCloud({...fixture,model:async()=>({answer:'unexpected'})}),error=>error.code==='PROVIDER_SMOKE_FAILED');
  assert.equal(await fs.readFile(fixture.articlesPath,'utf8'),original);
});
