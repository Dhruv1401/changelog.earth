# Final Verification Brief: changelog.earth Slice 2

## YOUR ROLE
You are verifying the implementation is correct. Do NOT modify any files. Only report problems.

## CONTEXT
The branch `feature/slice2-collection-classification` has been pushed to the fork.
Run `git log --oneline main..HEAD` to see the commits. Run `git diff main..HEAD` to see all changes.

The brief at `SLICE2-BRIEF.md` contains the original specification.

## VERIFICATION CHECKLIST

### 1. Schema Correctness
- `collectionSchema` in `lib/patch-titles.mjs` includes classification fields (domain, changeType, classificationScope, significance, significanceConfidence, significanceReason, evidenceStatus, subject, clusterKey, claim, whyItMatters)
- `titleOnlySchema` only includes title fields (sourceId, worldwide, scopeReason, kind, title)
- `extractClassification` in `lib/collection-classification.mjs` reads `entry.classificationScope` directly (no dead `?? entry.scope` fallback)
- `whyItMatters` defaults to empty string if omitted

### 2. Token Budget
- `maxOutputTokens` defaults to 6000 for collectionSchema and 3000 for titleOnlySchema
- The test in `scripts/check-changelog.mjs` has been updated to expect 6000

### 3. Error Handling
- Fallback to title-only ONLY triggers on `json_validate_failed` (schema rejection)
- Transient errors (network, rate limits) retry with the same schema
- `storeCollectionClassifications` failures are caught and logged, never thrown
- The `worldwide` field from the model output is preserved (uses `written` articles, not raw input)

### 4. Provenance
- `articlesWithOriginal` ensures `originalTitle` is set before `applyPatchTitles`
- `storeCollectionClassifications` receives `written` articles (preserves `titleRevision` and `worldwide`)
- Classification records include `sourceTitle`, `titleRevision`, `worldwide`

### 5. Backward Compatibility
- `needsClassification` in `lib/classification.mjs` still works for stories without collection-time classification
- The offline classification pass (Slice 1) still works for old stories
- `data/editions.json` format is unchanged

### 6. Tests
Run all tests:
```
node scripts/check-changelog.mjs
node scripts/check-collection.mjs
node scripts/check-classification.mjs
node scripts/check-news.mjs
node scripts/check-groq-only.mjs
```

All must pass.

### 7. Code Quality
- No dead code or unused variables
- Comments are accurate
- No console.log left behind (only console.warn for warnings)

## OUTPUT FORMAT
For each checklist item:
- State PASS or FAIL
- If FAIL, explain the problem and how to fix it

List any additional issues found. Do not praise. Do not summarize.
