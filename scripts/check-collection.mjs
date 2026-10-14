import assert from 'node:assert/strict';
import { groqJSON } from '../lib/groq.mjs';
import { readStore, saveCollectedClassifications } from '../lib/classification-store.mjs';
import { needsClassification } from '../lib/classification.mjs';
import { CLASSIFICATION_PROMPT_VERSION } from '../lib/classification-prompt.mjs';
import { writePatchTitles } from '../lib/patch-titles.mjs';
import { unlinkSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
assert.notEqual(signals[0],signals[1],'Each attempt gets its own generation deadline');
assert.equal(signals[0].aborted,false);
assert.equal(signals[1].aborted,false);
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
 const classifications = new Map();
 const written = await writePatchTitles(classifiedNews.articles, {
  apiKey: 'test',
  model: 'test-model',
  classifications,
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
 assert.equal(classifications.size, 1, 'Collection returns records keyed by source URL, without touching disk');
 const record = classifications.get('https://example.org/squid');
 assert.ok(record, 'A record is collected for the story');
 assert.equal(record.domain, 'oceans');
 assert.equal(record.changeType, 'DISCOVERED');
 assert.equal(record.scope, 'global');
 assert.equal(record.significance, 'notable');
 assert.equal(record.evidenceStatus, 'confirmed');
 assert.equal(record.method, 'collection', 'Collection records carry their own provenance, not the offline pass');
 assert.equal(record.provider, 'groq');
 assert.equal(record.model, 'test-model');
 assert.equal(record.promptVersion, CLASSIFICATION_PROMPT_VERSION);
 assert.equal(record.sourceTitle, 'Biologists discover glowing deep-sea squid');
 assert.equal(record.titleRevision, 1);

 // The collector script (and only it) writes the store; validateStore accepts method:'collection'.
 assert.equal(saveCollectedClassifications(classifications, testStorePath), 1, 'The collector writes one collected record');
 const savedStore = readStore(testStorePath);
 assert.equal(savedStore.records['https://example.org/squid'].method, 'collection');
 assert.equal(savedStore.retrospective, false, 'A store holding a live collection record is not retrospective');

 // The offline pass has richer input (category + summary), so it revisits a collection record.
 assert.equal(needsClassification(written, savedStore).length, 1, 'The offline pass revisits a collection record');

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
 const invalidCollected = new Map();
 const unblocked = await writePatchTitles([{
  title: 'Trench mapped',
  url: 'https://example.org/trench',
 }], {
  apiKey: 'test',
  classifications: invalidCollected,
  fetcher: async () => Response.json({
   choices: [{
    finish_reason: 'stop',
    message: { content: JSON.stringify({ entries: [invalidEntry] }) },
   }],
  }),
 });
 assert.equal(unblocked[0].title, invalidEntry.title);
 assert.equal(invalidCollected.size, 0, 'Invalid classification is skipped without failing collection');

 // Storage failure resilience: a genuinely unwritable destination is surfaced, so the collector can
 // catch and report it without blocking or erasing the edition. (A bad path on POSIX used to be a
 // legal filename and silently succeed.)
 const notADirectory = join(tmpdir(), `classifications-not-a-dir-${process.pid}`);
 writeFileSync(notADirectory, 'not a directory');
 try {
  assert.throws(() => saveCollectedClassifications(classifications, join(notADirectory, 'store.json')), 'A real storage failure is surfaced, not swallowed');
 } finally {
  rmSync(notADirectory, {force: true});
 }

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

 // Recursive splitting on json_validate_failed: a multi-article batch that fails validation
 // splits in half and retries each half with the collection schema, preserving classifications.
 const splitArticles = [
  { title: 'Coral species discovered in deep sea', originalTitle: 'Coral species discovered in deep sea', url: 'https://example.org/coral' },
  { title: 'Sodium battery reaches high density', originalTitle: 'Sodium battery reaches high density', url: 'https://example.org/battery' },
 ];
 const splitClassifications = new Map();
 const splitCalls = [];
 const splitResult = await writePatchTitles(splitArticles, {
  apiKey: 'test',
  classifications: splitClassifications,
  fetcher: async (_, req) => {
   const body = JSON.parse(req.body);
   const input = JSON.parse(body.messages[1].content);
   splitCalls.push(input.length);
   if (input.length === 2) {
    return new Response(JSON.stringify({
     error: { message: 'Generated JSON does not match expected schema', code: 'json_validate_failed' },
    }), { status: 400 });
   }
   const isCoral = input[0].headline.includes('Coral');
   const entry = isCoral ? {
    sourceId: 0,
    title: 'Deep coral joins marine roster',
    kind: 'Added',
    worldwide: true,
    scopeReason: 'Expands ocean biodiversity knowledge',
    domain: 'oceans',
    changeType: 'DISCOVERED',
    classificationScope: 'global',
    significance: 'notable',
    significanceConfidence: 'high',
    significanceReason: 'Expands understanding of deep corals.',
    evidenceStatus: 'confirmed',
    subject: 'deep coral',
    clusterKey: 'deep-coral',
    claim: 'A new deep-sea coral species was identified.',
    whyItMatters: 'Adds to known ocean biodiversity.',
   } : {
    sourceId: 0,
    title: 'Sodium battery stat raised in trials',
    kind: 'Buffed',
    worldwide: true,
    scopeReason: 'Advances energy storage technology',
    domain: 'energy',
    changeType: 'IMPROVED',
    classificationScope: 'global',
    significance: 'notable',
    significanceConfidence: 'high',
    significanceReason: 'Advances sodium battery capacity.',
    evidenceStatus: 'confirmed',
    subject: 'sodium battery',
    clusterKey: 'sodium-battery',
    claim: 'Sodium-ion cell reaches 160 Wh/kg in testing.',
    whyItMatters: 'Provides alternative to lithium-based cells.',
   };
   return Response.json({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ entries: [entry] }) } }],
   });
  },
 });
 assert.equal(splitCalls.length, 3, 'Batch of 2 that fails validation splits into 2 calls of 1');
 assert.deepEqual(splitCalls, [2, 1, 1]);
 assert.equal(splitResult.length, 2);
 assert.equal(splitResult[0].title, 'Deep coral joins marine roster');
 assert.equal(splitResult[1].title, 'Sodium battery stat raised in trials');
 assert.equal(splitClassifications.size, 2, 'Both split halves retain their collection classifications');
 assert.equal(splitClassifications.get('https://example.org/coral').domain, 'oceans');
 assert.equal(splitClassifications.get('https://example.org/battery').domain, 'energy');

 // The generated edition carries the collected records in their own top-level field, so the
 // collector script can persist them, and never folds them into the published articles.
 const { getChangelog: carrying } = await import('../lib/changelog.mjs?classification-carrying');
 const carried = await carrying({
  articles: [{
   title: 'Biologists discover glowing deep-sea squid',
   url: 'https://example.org/squid-carrying',
   date: '2026-10-13',
   category: 'Science & nature',
   publisher: 'Ocean Science',
   summary: 'Publisher details.',
  }],
  stale: [],
  unavailable: [],
 }, {
  apiKey: 'test',
  strict: true,
  fetcher: async () => Response.json({
   choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ entries: [fullEntry] }) } }],
  }),
 });
 assert.ok(carried.classifications, 'The draft response carries a separate top-level classifications field');
 assert.equal(carried.classifications['https://example.org/squid-carrying'].method, 'collection');
 assert.ok(carried.articles.every(article => !('classifications' in article)), 'Records never ride inside articles');

 console.log('Collection-time classification extraction, storage provenance, error tolerance, and schema fallback pass.');
} finally {
 try { if (existsSync(testStorePath)) unlinkSync(testStorePath); } catch {}
}
