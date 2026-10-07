import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isFresh, parseFeed, canonicalUrl, extractSource, discoverNews, publishBatch, validateArticles, scheduledSlot, batchDue, sameTopic, fetchSource } from './news-pipeline.mjs';

const now = '2026-10-07T18:00:00.000Z';
const sourceDate = '2026-10-07T10:00:00.000Z';
const config = { batchSize: 6, cadenceHours: 72, maxSourceAgeHours: 72, scheduleAnchor: now, requestTimeoutMs: 1000, feeds: [{ name: 'Source MMA', host: 'mma.test', url: 'https://mma.test/feed' }], officialHosts: [], maxFeedItems: 30, maxCandidates: 12 };
const evidence = ['The fighter accepted the new challenge announced today.', 'The organization confirmed this development during the interview.'];
const sourceBody = `${evidence.join(' ')} ${'The publication describes an announced UFC development, identifies the speaker and sets out the details as reported in the interview. '.repeat(6)}`;
function html(date = sourceDate, body = sourceBody) {
  return `<html><head><meta property="article:published_time" content="${date}"><meta property="article:modified_time" content="${now}"></head><body><article><h1>UFC announcement</h1><div class="entry-content"><p>${body}</p></div></article></body></html>`;
}
function item(i, date = sourceDate) { return `<item><title>UFC fighter ${i} announces uniquely ${['amber','bronze','copper','denim','emerald','fuchsia'][i]} development</title><link>https://mma.test/story/${i}</link>${date ? `<pubDate>${date}</pubDate>` : ''}</item>`; }
const mockFetch = async url => new Response(url.includes('/feed') ? `<rss><channel>${Array.from({ length: 6 }, (_, i) => item(i)).join('')}</channel></rss>` : html(), { status: 200 });
function article(i) {
  const name = ['amber','bronze','copper','denim','emerald','fuchsia'][i];
  return { slug: `actualite-${name}`, newsKey: `new-${name}`, title: `UFC ${name} actualité singulière`, excerpt: `Une actualité précise concernant ${name}.`, category: 'actualites', publishedAt: now, date: now.slice(0,10), sourcePublishedAt: sourceDate, image: `/assets/editorial/${name}.webp`, imageAlt: `Photo ${name}`, imageWidth: 1200, imageHeight: 675, content: [`<p>${'La déclaration est attribuée à son auteur et elle reste présentée comme une annonce à vérifier auprès de sa source. '.repeat(6)}</p>`], sources: [{ name: 'Source MMA', title: 'UFC announcement', url: `https://mma.test/story/${i}`, publishedAt: sourceDate, retrievedAt: now }], sourceEvidence: evidence.map(excerpt => ({ sourceUrl: `https://mma.test/story/${i}`, excerpt })) };
}
async function temporaryDatabase(t, articles = []) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'actu-mma-news-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const articlesPath = path.join(directory, 'articles.json');
  await fs.writeFile(articlesPath, JSON.stringify(articles)); return articlesPath;
}

test('freshness rejects missing, date-only, invalid, future and stale source publication', () => {
  for (const date of [null,'','bad','2026-10-07','2026-10-07T12:00:00','2026-10-07T18:00:01Z','2026-10-04T17:59:59Z']) assert.equal(isFresh(date,now),false,date);
  assert.equal(isFresh('2026-10-04T18:00:00Z',now),true);
});
test('RSS and Atom preserve original timestamps; updated-only feed cannot pass', () => {
  const rss = parseFeed(`<rss>${item(1,null)}</rss>`,config.feeds[0]); assert.equal(rss[0].publishedAt,null);
  const atom = parseFeed(`<feed><entry><title>MMA &amp; UFC</title><link href="https://mma.test/new"/><updated>${now}</updated></entry></feed>`,config.feeds[0]);
  assert.equal(atom[0].title,'MMA & UFC'); assert.equal(atom[0].publishedAt,null);
});
test('dedup ignores tracking and normalizes canonical path', () => {
  assert.equal(canonicalUrl('https://www.mma.test/news/?utm_source=x#top'),'https://mma.test/news');
  assert.equal(sameTopic({newsKey:'same',title:'A'}, {newsKey:'same',title:'B'}),true);
});
test('already-covered source title deduplicates across languages', async () => {
  const { duplicateOf }=await import('./news-pipeline.mjs');
  const existing={title:'Le Français répond à son adversaire',sources:[{title:'UFC fighter responds to the new challenge',url:'https://mma.test/old'}]};
  assert.equal(duplicateOf({title:'UFC fighter responds to new challenge',url:'https://mma.test/other-media'},[existing]),existing);
});
test('source extraction uses original publication and ignores modified-only dates', () => {
  assert.equal(extractSource(html('2026-01-01T10:00:00Z'),'https://mma.test/news').publishedAt,'2026-01-01T10:00:00.000Z');
  assert.equal(extractSource(html().replace(/<meta property="article:published_time"[^>]*>/,''),'https://mma.test/news').publishedAt,null);
});
test('transport follows canonical www and slash redirects without dedup normalization loops', async () => {
  const urls=[];
  const fetchImpl=async url=>{urls.push(url);return url==='https://mma.test/story' ? new Response(null,{status:301,headers:{location:'https://www.mma.test/story/'}}) : new Response(html(),{status:200});};
  await fetchSource('https://mma.test/story',config,fetchImpl);
  assert.deepEqual(urls,['https://mma.test/story','https://www.mma.test/story/']);
});
test('redirects to unknown hosts fail before making a request there', async () => {
  let calls=0; const fetchImpl=async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://internal.test/private'}});};
  await assert.rejects(fetchSource('https://mma.test/story',config,fetchImpl),error=>error.code==='UNTRUSTED_SOURCE'); assert.equal(calls,1);
});
test('72-hour schedule holds across month boundaries and repeated slots', () => {
  assert.equal(scheduledSlot('2026-11-01T18:00:00Z',config),'2026-10-31T18:00:00.000Z');
  assert.equal(batchDue([{...article(0),publicationBatchId:now}],now,config).due,false);
  assert.equal(batchDue([{...article(0),publicationBatchId:now}], '2026-10-10T17:59:59Z',config).due,false);
  assert.equal(batchDue([{...article(0),publishedAt:'2026-10-07T18:23:04Z',publicationBatchId:now}], '2026-10-10T18:17:00Z',config).due,true);
});
test('feed failure is explicit and never declares database synchronized', async () => {
  await assert.rejects(discoverNews({config,now,fetchImpl:async()=>{throw new Error('offline');}}),error=>error.code==='ALL_FEEDS_FAILED');
});
test('discovery rejects stale original article even when feed date is fresh', async () => {
  const result=await discoverNews({config,now,fetchImpl:async url=>new Response(url.includes('/feed')?`<rss>${item(0)}</rss>`:html('2026-01-01T10:00:00Z'))});
  assert.equal(result.status,'insufficient-fresh-sources');assert.equal(result.candidates.length,0);
});
test('feed timestamp discrepancy preserves immutable original page publication time',async()=>{
  const result=await discoverNews({config,now,fetchImpl:async url=>new Response(url.includes('/feed')?`<rss>${item(0,'2026-10-07T09:59:00Z')}</rss>`:html())});
  assert.equal(result.candidates[0].publishedAt,sourceDate);
  assert.equal(result.candidates[0].feedPublishedAt,'2026-10-07T09:59:00.000Z');
});
test('five articles and duplicate topics never modify publication data', async t => {
  const articlesPath=await temporaryDatabase(t); const original=await fs.readFile(articlesPath,'utf8');
  await assert.rejects(publishBatch({batch:Array.from({length:5},(_,i)=>article(i)),articlesPath,config,now,fetchImpl:mockFetch}),error=>error.code==='WRONG_BATCH_SIZE');
  const batch=Array.from({length:6},(_,i)=>article(i));batch[5].newsKey=batch[0].newsKey;
  await assert.rejects(publishBatch({batch,articlesPath,config,now,fetchImpl:mockFetch}),error=>error.code==='DUPLICATE_BATCH');
  assert.equal(await fs.readFile(articlesPath,'utf8'),original);
});
test('unsupported evidence in last article aborts entire batch', async t => {
  const articlesPath=await temporaryDatabase(t);const batch=Array.from({length:6},(_,i)=>article(i));batch[5].sourceEvidence[0].excerpt='A fabricated passage that never appeared in any report.';
  await assert.rejects(publishBatch({batch,articlesPath,config,now,fetchImpl:mockFetch}),error=>error.code==='UNSUPPORTED_EVIDENCE');
  assert.deepEqual(JSON.parse(await fs.readFile(articlesPath,'utf8')),[]);
});
test('six verified articles commit atomically, preserve archives and prevent rerun', async t => {
  const archive={slug:'guide-ancien',title:'Guide technique',excerpt:'Guide',category:'guides',date:'2025-01-01',content:['<p>Archives.</p>']};
  const articlesPath=await temporaryDatabase(t,[archive]);const batch=Array.from({length:6},(_,i)=>article(i));
  const result=await publishBatch({batch,articlesPath,config,now,fetchImpl:mockFetch});assert.equal(result.published,6);
  const articles=JSON.parse(await fs.readFile(articlesPath,'utf8'));assert.deepEqual(articles.at(-1),archive);assert.equal(articles[0].sourceEvidence,undefined);assert.equal(articles[0].evidenceHashes.length,2);
  await assert.rejects(publishBatch({batch,articlesPath,config,now,fetchImpl:mockFetch}),error=>error.code==='NOT_DUE');
});
test('concurrent publisher cannot acquire transaction lock', async t => {
  const articlesPath=await temporaryDatabase(t);await fs.writeFile(`${articlesPath}.news-lock`,'test');
  await assert.rejects(publishBatch({batch:Array.from({length:6},(_,i)=>article(i)),articlesPath,config,now,fetchImpl:mockFetch}),error=>error.code==='PUBLICATION_LOCKED');
});
test('distinct evidence and source coverage are required even outside actualites category',()=>{
  const a=article(0);a.category='evenements';a.sourceEvidence=[a.sourceEvidence[0],a.sourceEvidence[0]];
  assert.equal(validateArticles([a],{now,batch:true,config}).ok,false);
  delete a.sources;assert.equal(validateArticles([a],{now,batch:true,config}).ok,false);
});
test('batch requires a public news status and reporting category; archives retain their categories',()=>{
  const a=article(0);a.status='draft';assert.equal(validateArticles([a],{now,batch:true,config}).ok,false);
  a.status='quarantined';assert.equal(validateArticles([a],{now,batch:true,config}).ok,false);
  a.status='published';a.category='guides';assert.equal(validateArticles([a],{now,batch:true,config}).ok,false);
  assert.equal(validateArticles([a],{now,config}).ok,true);
  a.category='evenements';assert.equal(validateArticles([a],{now,batch:true,config}).ok,true);
});
test('archives remain valid after source freshness window expires', () => {
  assert.equal(validateArticles([article(0)],{now:'2027-01-01T00:00:00Z',config}).ok,true);
});
