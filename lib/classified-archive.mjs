import { classifyArticle } from './taxonomy-fallback.mjs';

// Stored classifications are authoritative; anything missing is derived on read and reported as
// inferred. One pass builds the result, so a large archive never costs a lookup per article.
// This module only joins records to articles and derives the missing ones. Measuring the joined
// result is lib/classification-report.mjs, so the derivation can be read without the reporting.
export function classifyArchiveRecords(articles, records = {}) {
 // Accepts the store's URL-keyed object or a Map, so a batch result can be joined without a copy.
 const lookup = records instanceof Map ? url => records.get(url) : url => records?.[url];
 const entries = [];
 for (const article of articles) {
  const stored = lookup(article.url);
  // A record derived from a headline the archive has since corrected describes something we no
  // longer publish, so its fields are derived afresh rather than trusted.
  const matches = Boolean(stored) && stored.sourceTitle === (article.originalTitle ?? article.title) && (stored.titleRevision ?? 0) === (article.titleRevision ?? 0);
  const fields = matches ? stored : classifyArticle(article);
  // Provenance is the record's own, never the pass that reads it: a stored collection record stays
  // 'collection' rather than being relabelled 'ai'. It is also reported stale here, because the
  // offline pass revisits every collection record — its prompt saw only the headline, not the
  // category and summary. A record that no longer matches the article headline/revision is stale
  // for the other reason: it describes a headline we no longer publish. Note that `stale` on read
  // reflects mismatch or preliminary collection provenance; unlike needsClassification (lib/classification.mjs),
  // the read layer does not treat older prompt versions as stale. A missing record is not
  // stale; nothing is owed, it is simply derived on read.
  const method = matches ? stored.method : 'inferred';
  const stale = Boolean(stored) && (!matches || method === 'collection');
  entries.push({
   url:article.url, title:article.title, originalTitle:article.originalTitle ?? article.title,
   publisher:article.publisher, provider:article.provider, category:article.category, kind:article.kind,
   date:article.date, day:article.date.slice(0,10), published:article.worldwide !== false,
   method, stale,
   ...(matches ? {classifiedAt:stored.classifiedAt, classifiedBy:stored.model ?? null, promptVersion:stored.promptVersion} : {}),
   domain:fields.domain, changeType:fields.changeType, scope:fields.scope, significance:fields.significance,
   significanceConfidence:matches ? stored.significanceConfidence : 'low', significanceReason:matches ? stored.significanceReason : '',
   evidenceStatus:fields.evidenceStatus, subject:fields.subject ?? '', clusterKey:fields.clusterKey ?? '',
   claim:fields.claim ?? '', whyItMatters:fields.whyItMatters ?? '',
  });
 }
 // Deterministic order: newest first, then URL, so reports and pages never depend on collection order.
 return entries.sort((a,b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
}
