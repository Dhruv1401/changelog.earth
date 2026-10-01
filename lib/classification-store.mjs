import { writeFileSync, renameSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CLASSIFICATION_FIELDS, CLASSIFICATION_PROMPT_VERSION } from './classification.mjs';
import { isChangeType, isDomain, isEvidenceStatus, isPlainText, isScope, isSignificance, isSlug } from './taxonomy.mjs';

export const STORE_VERSION = 1;
export const STORE_PATH = new URL('../data/classifications.json', import.meta.url);

// Derived data with its own provenance. It is keyed by source URL so the join is a map lookup
// per article, and it never replaces or rewrites the published archive.
export function emptyStore() {
 return {version:STORE_VERSION, promptVersion:CLASSIFICATION_PROMPT_VERSION, retrospective:true, model:null, createdAt:null, updatedAt:null, records:{}};
}

export function validateStore(store) {
 if (!store || typeof store !== 'object') throw new Error('Invalid classification store');
 if (!Number.isSafeInteger(store.version) || store.version < 1) throw new Error('Invalid classification store version');
 if (typeof store.records !== 'object' || store.records === null) throw new Error('Invalid classification records');
 for (const [url, record] of Object.entries(store.records)) {
  try { new URL(url); } catch { throw new Error('Invalid classification source URL'); }
  if (!record || !CLASSIFICATION_FIELDS.every(field => field in record)) throw new Error('Incomplete classification record');
  if (!isDomain(record.domain) || !isChangeType(record.changeType) || !isScope(record.scope) || !isSignificance(record.significance) || !isEvidenceStatus(record.evidenceStatus)) throw new Error('Stored classification outside the taxonomy');
  if (!['high','medium','low'].includes(record.significanceConfidence)) throw new Error('Invalid classification confidence');
  if (!isPlainText(record.significanceReason, 300) || !isPlainText(record.subject, 80) || !isPlainText(record.claim, 400) || !isSlug(record.clusterKey)) throw new Error('Invalid stored classification text');
  if (typeof record.whyItMatters !== 'string' || record.whyItMatters.length > 300) throw new Error('Invalid stored classification whyItMatters');
  if (record.method !== 'ai' || typeof record.classifiedAt !== 'string' || !Number.isFinite(Date.parse(record.classifiedAt))) throw new Error('Stored classification lacks provenance');
  if (record.promptVersion !== CLASSIFICATION_PROMPT_VERSION) throw new Error('Stored classification prompt version is not supported');
  if (typeof record.sourceTitle !== 'string' || !record.sourceTitle.length) throw new Error('Stored classification lacks its source headline');
 }
 return store;
}

export function readStore(path = STORE_PATH) {
 if (!existsSync(path)) return emptyStore();
 const store = JSON.parse(readFileSync(path, 'utf8'));
 return validateStore(store);
}

// Atomic replace so an interrupted run never leaves a half-written artifact behind.
export function writeStore(store, path = STORE_PATH, now = Date.now()) {
 validateStore(store);
 mkdirSync(dirname(path), {recursive:true});
 const stamped = {...store, version:STORE_VERSION, updatedAt:new Date(now).toISOString(), createdAt:store.createdAt ?? new Date(now).toISOString()};
 const temporary = `${path}.tmp`;
 writeFileSync(temporary, `${JSON.stringify(stamped, null, 2)}\n`);
 renameSync(temporary, path);
 return stamped;
}

export function putRecords(store, records, model) {
 const next = {...store, records:{...store.records}};
 for (const [url, record] of records) next.records[url] = record;
 if (model) next.model = model;
 return next;
}

export function storeStats(store) {
 const methods = {};
 for (const record of Object.values(store.records ?? {})) methods[record.method] = (methods[record.method] ?? 0) + 1;
 return {records:Object.keys(store.records ?? {}).length, methods, promptVersion:store.promptVersion, model:store.model, updatedAt:store.updatedAt};
}