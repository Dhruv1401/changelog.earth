# Second Review Brief: Verify Slice 2 Fixes

## YOUR ROLE
You are reviewing the fixes made after the first critic pass found 15 issues (7 needed fixing). Your job is to verify the fixes are correct and look for any new problems.

## CONTEXT
The repository has two commits on branch `feature/slice2-collection-classification`:
1. `6eca0b3` — initial implementation
2. `2fea5d1` — fixes for 7 critic issues

Run `git diff 6eca0b3..2fea5d1` to see the fixes. Run `git diff main..HEAD` to see the full change.

## FIXES TO VERIFY

1. **Schema sync**: `extractClassification` should read `entry.classificationScope` directly, not `entry.classificationScope ?? entry.scope`. Check `lib/collection-classification.mjs`.

2. **Token budget**: `maxOutputTokens` should default to 6000 for collectionSchema and 3000 for titleOnlySchema. Check `lib/patch-titles.mjs`.

3. **Provenance**: `storeCollectionClassifications` should receive the original `articles` array, not `written`. Check `lib/patch-titles.mjs`.

4. **Error handling**: Retry should only downgrade to title-only on `json_validate_failed`, not on any error. Check `lib/patch-titles.mjs`.

5. **whyItMatters default**: Should default to empty string if omitted. Check `lib/collection-classification.mjs`.

6. **Options destructuring**: Should use `options.model ?? articles?.[0]?.titleModel`, not `options.titleModel`. Check `lib/collection-classification.mjs`.

7. **Console warning**: Invalid classification fields should log a warning. Check `lib/collection-classification.mjs`.

## ALSO CHECK

- Do the fixes introduce any new bugs?
- Are the fixes complete (not partial)?
- Do the existing tests still pass? Run them.
- Is the code still readable and maintainable?

## TESTS TO RUN

```bash
node scripts/check-changelog.mjs
node scripts/check-collection.mjs
node scripts/check-classification.mjs
node scripts/check-news.mjs
node scripts/check-groq-only.mjs
```

## OUTPUT FORMAT

For each fix:
- State whether it's correct, partially correct, or incorrect
- If incorrect, explain why and how to fix it

For each test:
- State PASS or FAIL

List any new issues found. Do not praise. Do not summarize.
