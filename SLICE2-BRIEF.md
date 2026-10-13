# Slice 2 Brief: Fold Structured Extraction into the Collection Call

## HARD CONSTRAINTS (violating any of these fails the entire slice)

1. **NO extra model calls per run.** The structured extraction MUST happen inside the existing Groq API call in `writePatchTitles`. Do not add a second API call.
2. **`data/editions.json` and homepage/API output stay unchanged.** The published archive format must not change. No new fields in editions.json. No changes to the homepage, RSS, or public API response shape.
3. **A failed or invalid extraction NEVER blocks or erases a published edition.** If classification fails for any reason (schema rejection, timeout, invalid output), the patch titles must still be generated and the collection must continue. Classification is a best-effort enrichment layer.
4. **Do NOT touch `lib/patch-titles.mjs`'s existing title generation logic.** The title prompt, validation, and rewrite pass are working and reviewed. You are EXTENDING the schema, not rewriting the prompt.
5. **Do NOT touch `data/editions.json` or `lib/edition-archive.mjs`.** The archive format is frozen.
6. **Commit locally only. Do NOT push. Do NOT comment on GitHub.**
7. **Run all existing tests before reporting.** The repo has check scripts — run them.

## CONTEXT

### Current Collection Flow
1. `scripts/archive-editions.mjs` calls `GET /api/news?archive=<timestamp>` with auth header
2. `app/api/news/route.ts` → `getPublishedChangelog({draft:true})`
3. `lib/published-changelog.mjs` → `getChangelog()` → `writePatchTitles()`
4. `lib/patch-titles.mjs` sends up to 24 headlines to Groq in ONE API call
5. Groq returns: `sourceId, worldwide, scopeReason, kind, title` per headline
6. A rewrite pass may fix headline-style titles (second API call, quality only)
7. Articles merge into `data/editions.json` via `scripts/archive-editions.mjs`

### Current Classification Flow (Slice 1 — offline, retrospective)
1. `scripts/classify-archive.mjs` reads `data/editions.json`
2. Sends stories to Groq in 25-story batches with classification prompt
3. Groq returns: `domain, changeType, scope, significance, significanceConfidence, significanceReason, evidenceStatus, subject, clusterKey, claim, whyItMatters`
4. Stored in `data/classifications.json`, keyed by source URL
5. This is OFFLINE — it runs after publication, not during collection

### What Slice 2 Does
Folds the classification INTO the collection call. When `writePatchTitles` sends headlines to Groq, the same call ALSO returns the classification fields. This means:
- Classification happens at collection time, not retrospectively
- No separate classification pass is needed for new stories
- The classification store gets populated automatically as a side effect of collection

## DETAILED SPECIFICATION

### 1. Extended Groq Schema (`lib/patch-titles.mjs`)

The current schema in `writePatchTitles` returns:
```json
{
  "entries": [{
    "sourceId": "integer",
    "worldwide": "boolean",
    "scopeReason": "string",
    "kind": "enum",
    "title": "string"
  }]
}
```

Extend it to ALSO return classification fields per entry:
```json
{
  "entries": [{
    "sourceId": "integer",
    "worldwide": "boolean",
    "scopeReason": "string",
    "kind": "enum",
    "title": "string",
    "domain": "string (enum from taxonomy)",
    "changeType": "string (enum from taxonomy)",
    "classificationScope": "string (enum: local/regional/global/planetary)",
    "significance": "string (enum: minor/notable/major/epochal)",
    "significanceConfidence": "string (enum: low/medium/high)",
    "significanceReason": "string (max 300 chars)",
    "evidenceStatus": "string (enum: confirmed/preliminary/conflicting/revised/retracted)",
    "subject": "string (max 80 chars)",
    "clusterKey": "string (lowercase slug)",
    "claim": "string (max 400 chars)",
    "whyItMatters": "string (max 300 chars, may be empty)"
  }]
}
```

**CRITICAL:** The classification fields must be OPTIONAL in the schema. If the model omits them or returns null, the collection must still succeed. Only `sourceId, worldwide, scopeReason, kind, title` are required.

### 2. Classification Storage

Create a new function `lib/collection-classification.mjs` that:
- Takes the classification data from the Groq response
- Writes it to `data/classifications.json` (same format as Slice 1)
- Keyed by source URL (same as Slice 1)
- Includes the same provenance: `promptVersion, model, classifiedAt, sourceTitle, titleRevision`
- Uses `CLASSIFICATION_PROMPT_VERSION` from `classification-prompt.mjs`
- If the classification data is missing/invalid for a story, simply skip it — do not fail

### 3. Integration Point (`lib/patch-titles.mjs`)

In `writePatchTitles`, after the Groq response is received and validated:
1. Extract the classification fields from each entry
2. Pass them to `lib/collection-classification.mjs` to store
3. If classification storage fails, log a warning and CONTINUE — do not throw
4. The existing title validation and rewrite logic must work exactly as before

### 4. Prompt Extension (`lib/patch-titles.mjs`)

The current instruction in `writePatchTitles` focuses on patch titles. You need to ADD classification instructions to the same prompt. The prompt should:
- First ask for the patch title (existing behavior)
- Then ask for the classification fields (new)
- Make clear that classification is secondary to titles
- Use the SAME vocabulary as `lib/classification-prompt.mjs`

**IMPORTANT:** The prompt must be carefully constructed so that adding classification fields does NOT degrade title quality. Test with `node scripts/check-changelog.mjs` and `node scripts/check-collection.mjs`.

### 5. Error Handling

The following must NEVER cause collection to fail:
- Groq returns entries with missing classification fields
- Groq returns invalid classification values (outside taxonomy)
- Classification storage fails (file I/O error, etc.)
- The classification prompt addition causes Groq to reject the schema

If ANY of these happen:
- Log a warning to console
- Continue with title generation as normal
- The story still gets published, just without classification data

### 6. Backward Compatibility

- Stories collected BEFORE this change will not have classification data in `data/classifications.json`
- The offline classification pass (Slice 1) should still work for those stories
- The `needsClassification` function in `classification.mjs` should recognize stories that already have collection-time classification and skip them

### 7. Files You Will Touch

- `lib/patch-titles.mjs` — extend schema, add classification extraction, integrate storage
- `lib/collection-classification.mjs` — NEW file, handles writing classification data
- `lib/classification-prompt.mjs` — possibly extend to share vocabulary between offline and collection-time classification
- `scripts/check-collection.mjs` — possibly add a check for collection-time classification

### 8. Files You Will NOT Touch

- `data/editions.json` — frozen
- `lib/edition-archive.mjs` — frozen
- `lib/published-changelog.mjs` — frozen
- `lib/changelog.mjs` — frozen
- `app/api/news/route.ts` — frozen
- `scripts/archive-editions.mjs` — frozen
- `lib/classification.mjs` — the offline classification path stays as-is for backward compat
- `lib/classification-store.mjs` — the store format is already defined
- `lib/taxonomy.mjs` — the vocabulary is frozen
- `lib/taxonomy-fallback.mjs` — frozen
- `lib/editorial-policy.mjs` — frozen

## TESTS TO RUN

```bash
node scripts/check-changelog.mjs
node scripts/check-collection.mjs
node scripts/check-classification.mjs
node scripts/check-news.mjs
node scripts/check-groq-only.mjs
```

All must pass. If any fail, fix the issue before reporting.

## DECISION LOG

For each change you make, document:
1. What you changed
2. Why you changed it
3. What you considered and rejected
4. Any risks or trade-offs

## REPORT FORMAT

Report back with:
1. Summary of changes
2. Files modified
3. Test results (paste the output)
4. Decision log
5. Any concerns or risks
6. What you did NOT verify
