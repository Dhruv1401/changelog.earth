import {
  isDomain,
  isChangeType,
  isScope,
  isSignificance,
  isEvidenceStatus,
  isPlainText,
  isSlug,
  CONFIDENCE_IDS,
} from './taxonomy.mjs';
import { CLASSIFICATION_PROMPT_VERSION } from './classification-prompt.mjs';

// Pure collection: this module only validates and shapes records. It deliberately imports nothing
// from classification-store.mjs (which pulls in the filesystem module and the lock code), because
// collection runs inside the /api/news request on a read-only production filesystem. The caller
// that owns a filesystem (scripts/archive-editions.mjs) persists what this returns.
const MAX = { significanceReason: 300, subject: 80, claim: 400, whyItMatters: 300 };

const CLASSIFICATION_FIELDS = [
  'domain',
  'changeType',
  'classificationScope',
  'significance',
  'significanceConfidence',
  'significanceReason',
  'evidenceStatus',
  'subject',
  'clusterKey',
  'claim',
  'whyItMatters',
];

/**
 * Validates and extracts classification fields from a collection response entry.
 * Returns null if any classification field is missing or invalid.
 */
export function extractClassification(entry, article, {
  model = 'openai/gpt-oss-120b',
  promptVersion = CLASSIFICATION_PROMPT_VERSION,
  now = Date.now(),
  provider = 'groq',
  method = 'collection',
} = {}) {
  if (!entry || typeof entry !== 'object' || !article || typeof article !== 'object' || !article.url) {
    return null;
  }

  const values = CLASSIFICATION_FIELDS.map(field => entry[field]);
  const allNull = values.every(val => val === null || val === undefined);
  if (allNull) {
    return null;
  }

  const scope = entry.classificationScope;

  const valid =
    isDomain(entry.domain) &&
    isChangeType(entry.changeType) &&
    isScope(scope) &&
    isSignificance(entry.significance) &&
    CONFIDENCE_IDS.includes(entry.significanceConfidence) &&
    isEvidenceStatus(entry.evidenceStatus) &&
    isPlainText(entry.significanceReason, MAX.significanceReason) &&
    isPlainText(entry.subject, MAX.subject) &&
    isSlug(entry.clusterKey) &&
    isPlainText(entry.claim, MAX.claim) &&
    typeof (entry.whyItMatters ?? '') === 'string' &&
    (entry.whyItMatters ?? '').length <= MAX.whyItMatters;

  if (!valid) {
    console.warn(`Invalid classification for ${article.url}: entry has classification fields but failed validation`);
    return null;
  }

  const whyItMatters = entry.whyItMatters ?? '';

  return {
    domain: entry.domain,
    changeType: entry.changeType,
    scope,
    significance: entry.significance,
    significanceConfidence: entry.significanceConfidence,
    significanceReason: entry.significanceReason.trim(),
    evidenceStatus: entry.evidenceStatus,
    subject: entry.subject.trim(),
    clusterKey: entry.clusterKey,
    claim: entry.claim.trim(),
    whyItMatters: whyItMatters.trim(),
    method,
    provider,
    model: model ?? null,
    promptVersion,
    classifiedAt: new Date(now).toISOString(),
    sourceTitle: article.originalTitle ?? article.title,
    titleRevision: article.titleRevision ?? 0,
    worldwide: article.worldwide !== false,
  };
}

/**
 * Collects valid collection-time classifications from a collection response.
 * Pure: reads nothing from disk and writes nothing. Returns a Map keyed by source URL, so the
 * caller can either put it on the request response or persist it. Invalid or missing entries are
 * skipped, never thrown: a bad classification must not fail the title collection.
 */
export function collectCollectionClassifications(articles, outputOrEntries, options = {}) {
  const rawEntries = Array.isArray(outputOrEntries) ? outputOrEntries : outputOrEntries?.entries;
  if (!Array.isArray(rawEntries) || !articles?.length) return new Map();

  const {
    model = articles?.[0]?.titleModel ?? 'openai/gpt-oss-120b',
    now = Date.now(),
    provider = 'groq',
  } = options;

  const validRecords = new Map();
  for (const entry of rawEntries) {
    if (!entry || !Number.isInteger(entry.sourceId)) continue;
    const article = articles[entry.sourceId];
    if (!article || !article.url) continue;

    const record = extractClassification(entry, article, {
      model,
      promptVersion: CLASSIFICATION_PROMPT_VERSION,
      now,
      provider,
    });

    if (record) {
      validRecords.set(article.url, record);
    }
  }

  return validRecords;
}
