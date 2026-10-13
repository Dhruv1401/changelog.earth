import assert from 'node:assert/strict';
import { groqJSON } from '../lib/groq.mjs';
import { readStore } from '../lib/classification-store.mjs';
import { needsClassification } from '../lib/classification.mjs';
import { CLASSIFICATION_PROMPT_VERSION } from '../lib/classification-prompt.mjs';
import { writePatchTitles } from '../lib/patch-titles.mjs';
import { unlinkSync, existsSync } from 'node:fs';
let calls=0;
const result=await groqJSON('test','{}',{apiKey:'test',fetcher:async()=>++calls===1 ? new Response('',{status:429,headers:{'retry-after':'0'}}) : Response.json({choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]})});
assert.equal(result.ok,true); assert.equal(calls,2);
calls=0;
await assert.rejects(groqJSON('test','{}',{apiKey:'test',fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'120'}})}}),/Groq HTTP 429/);
assert.equal(calls,1);
const {getChangelog}=await import('../lib/changelog.mjs?strict-collection');
const news={articles:[{title:'New scientific discovery',url:'https://example.org/new',date:'2026-09-20',category:'Science & nature'}],stale:[],unavailable:[]};
await assert.rejects(getChangelog(news,{strict:true}),/not configured/);
await assert.rejects(getChangelog(news,{strict:true,apiKey:'test',fetcher:async()=>new Response('',{status:429})}),/Groq HTTP 429/);
const {getChangelog:empty}=await import('../lib/changelog.mjs?empty-collection');
assert.equal((await empty({...news,articles:[]},{strict:true,apiKey:'test',fetcher:async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'{"entries":[]}'}}]})})).editorial,'empty');
console.log('Rate-limit retry, bounded waiting, explicit collection failure and genuinely empty selection pass.');

// A malformed generated title must get one recovery attempt on the strict collection path.
const {getChangelog:recover}=await import('../lib/changelog.mjs?title-recovery');
const validEntry={sourceId:0,title:'New species joins the roster',kind:'Added',worldwide:true,scopeReason:'New discovery'};
const reply=entry=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({entries:[entry]})}}]});
let titleCalls=0;
const signals=[];
const recovered=await recover(news,{strict:true,apiKey:'test',fetcher:async(_,request)=>{signals.push(request.signal);return reply(++titleCalls===1 ? {...validEntry,title:'x'.repeat(81)} : validEntry);}});
assert.equal(titleCalls,2);
assert.equal(signals[0],signals[1],'Retries share the original generation deadline');
assert.equal(recovered.editorial,'generated');
assert.equal(recovered.articles[0].title,validEntry.title);
const {getChangelog:invalid}=await import('../lib/changelog.mjs?title-recovery-fails');
titleCalls=0;
await assert.rejects(invalid(news,{strict:true,apiKey:'test',fetcher:async()=>{titleCalls++;return reply({...validEntry,sourceId:4});}}),/Invalid patch title/);
assert.equal(titleCalls,2,'Invalid output must not retry indefinitely');
console.log('Invalid title recovery and bounded strict validation pass.');

// Collection-time structured extraction: folds classification into the collection call without extra model calls.
const testStorePath = new URL(`../data/test-classifications-${process.pid}.json`, import.meta.url);
try {
 const classifiedNews = {
  articles: [{
   title: 'Biologists discover glowing deep-sea squid',
   originalTitle: 'Biologists discover glowing deep-sea squid',
   url: 'https://example.org/squid',
   date: '2026-10-13',
   publisher: 'Ocean Science',
   category: 'Science & nature',
  }],
 };
 const fullEntry = {
  sourceId: 0,
  title: 'Glowing squid joins deep-sea roster',
  kind: 'Added',
  worldwide: true,
  scopeReason: 'Expands marine biology roster',
  domain: 'oceans',
  changeType: 'DISCOVERED',
  classificationScope: 'global',
  significance: 'notable',
  significanceConfidence: 'high',
  significanceReason: 'Expands shared scientific understanding of bioluminescence.',
  evidenceStatus: 'confirmed',
  subject: 'deep-sea squid',
  clusterKey: 'deep-sea-squid',
  claim: 'A new bioluminescent squid was identified in deep waters.',
  whyItMatters: 'Adds to the known biodiversity of the twilight zone.',
 };
 const classifyCalls = [];
 const written = await writePatchTitles(classifiedNews.articles, {
  apiKey: 'test',
  model: 'test-model',
  storePath: testStorePath,
  fetcher: async (url) => {
   classifyCalls.push(url);
   return Response.json({
    choices: [{
     finish_reason: 'stop',
     message: { content: JSON.stringify({ entries: [fullEntry] }) },
    }],
   });
  },
 });
 assert.equal(classifyCalls.length, 1, 'Collection and extraction happen in exactly ONE model call');
 assert.equal(written[0].title, fullEntry.title);
 const savedStore = readStore(testStorePath);
 const record = savedStore.records['https://example.org/squid'];
 assert.ok(record, 'Record was stored in classifications store');
 assert.equal(record.domain, 'oceans');
 assert.equal(record.changeType, 'DISCOVERED');
 assert.equal(record.scope, 'global');
 assert.equal(record.significance, 'notable');
 assert.equal(record.evidenceStatus, 'confirmed');
 assert.equal(record.method, 'ai');
 assert.equal(record.provider, 'groq');
 assert.equal(record.model, 'test-model');
 assert.equal(record.promptVersion, CLASSIFICATION_PROMPT_VERSION);
 assert.equal(record.sourceTitle, 'Biologists discover glowing deep-sea squid');
 assert.equal(record.titleRevision, 1);

 // Backward compatibility: needsClassification recognizes the story is already classified and skips it.
 assert.equal(needsClassification(written, savedStore).length, 0, 'Classified story is recognized and skipped by offline classifier');

 // Partial/missing or invalid classification: title still generated, collection never blocked.
 const invalidEntry = {
  sourceId: 0,
  title: 'Deep trench map expanded',
  kind: 'Updated',
  worldwide: true,
  scopeReason: 'New trench mapping data',
  domain: 'not-a-domain',
  changeType: 'UNKNOWN',
 };
 const unblocked = await writePatchTitles([{
  title: 'Trench mapped',
  url: 'https://example.org/trench',
 }], {
  apiKey: 'test',
  storePath: testStorePath,
  fetcher: async () => Response.json({
   choices: [{
    finish_reason: 'stop',
    message: { content: JSON.stringify({ entries: [invalidEntry] }) },
   }],
  }),
 });
 assert.equal(unblocked[0].title, invalidEntry.title);
 assert.equal(readStore(testStorePath).records['https://example.org/trench'], undefined, 'Invalid classification skipped without error');

 // Storage failure resilience: invalid store path does not fail collection.
 const badStorage = await writePatchTitles([{
  title: 'Coral reef survey updated',
  url: 'https://example.org/coral',
 }], {
  apiKey: 'test',
  storePath: 'Z:\\nonexistent\\path\\store.json',
  fetcher: async () => Response.json({
   choices: [{
    finish_reason: 'stop',
    message: { content: JSON.stringify({ entries: [fullEntry] }) },
   }],
  }),
 });
 assert.equal(badStorage.length, 1, 'Storage failure never blocks collection');

 // Schema rejection fallback: json_validate_failed falls back to title-only extraction.
 let fallbackAttempts = 0;
 const fallbackResult = await writePatchTitles([{
  title: 'New telescope launched into orbit',
  url: 'https://example.org/telescope',
 }], {
  apiKey: 'test',
  fetcher: async () => {
   fallbackAttempts++;
   if (fallbackAttempts === 1) {
    return new Response(JSON.stringify({
     error: { message: 'Schema validation error', code: 'json_validate_failed' },
    }), { status: 400 });
   }
   return Response.json({
    choices: [{
     finish_reason: 'stop',
     message: { content: JSON.stringify({ entries: [{
      sourceId: 0,
      title: 'Telescope joins orbital roster',
      kind: 'Added',
      worldwide: true,
      scopeReason: 'New space observatory',
     }] }) },
    }],
   });
  },
 });
 assert.equal(fallbackResult[0].title, 'Telescope joins orbital roster');
 console.log('Collection-time classification extraction, storage provenance, error tolerance, and schema fallback pass.');
} finally {
 try { if (existsSync(testStorePath)) unlinkSync(testStorePath); } catch {}
}
