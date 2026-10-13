# Critic Pass Brief: Review Slice 2 Changes

## YOUR ROLE
You are a hostile code reviewer. Your job is to find problems, not to praise. Do not summarize the diff. Do not say what looks good. List ONLY problems.

## CONTEXT
The changes implement "Slice 2" of the changelog.earth event taxonomy project: folding structured classification extraction into the existing collection call. The brief is at SLICE2-BRIEF.md.

## WHAT TO REVIEW
Run `git diff` in this repository to see all changes. Also read SLICE2-BRIEF.md for the full specification.

## SPECIFIC THINGS TO CHECK

1. **Schema correctness**: The collectionSchema in lib/patch-titles.mjs has both `classificationScope` and `scope` fields with the same enum. Is this a bug? Does it cause confusion?

2. **Extra API calls**: The brief says "NO extra model calls per run." But the fallback to title-only schema when collection schema fails IS an extra call. Is this a violation? Can it be fixed?

3. **Error handling**: If `storeCollectionClassifications` throws, does it properly catch and continue? Trace the error path.

4. **The `lastOutput` variable**: In `writePatchTitles`, `lastOutput` is set after `applyPatchTitles` succeeds. But if the first attempt with collectionSchema fails with json_validate_failed, and the title-only fallback succeeds, is `lastOutput` correct?

5. **Unrelated changes**: `scripts/check-classification.mjs` and `scripts/install-ci.mjs` were modified. Are these changes related to the brief? If not, they should be reverted.

6. **Test coverage**: The brief says "Run all existing tests before reporting." Were any tests run? Are there new tests for the collection classification?

7. **Backward compatibility**: Will stories collected before this change still work with the offline classification pass? Does `needsClassification` properly skip stories that already have collection-time classification?

8. **The `extractClassification` function**: It returns null if ANY field is invalid. Is this too strict? What happens if the model returns valid titles but slightly invalid classification data?

9. **The `storeCollectionClassifications` options destructuring**: The function destructures `model` from options but falls back to `options.titleModel`. Is this correct? What does the caller actually pass?

10. **Missing commit**: The brief says "Commit locally when done." No commit was made. Why?

## OUTPUT FORMAT
For each issue found:
- File and line number
- What the problem is
- Why it matters
- How to fix it

If an item is genuinely correct, say so in one line. Do not pad the review with praise.
