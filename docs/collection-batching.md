# Collection Batching, Token Usage, and Schema Reliability

This document records live measurements taken against the Groq API using `openai/gpt-oss-120b`, `strict: true`, and `reasoning_effort: 'low'` during the development of collection-time structured classification.

## 1. Measured Token Usage

| Headlines in batch | prompt_tokens | completion_tokens | reasoning_tokens |
|---|---|---|---|
| 6  | 992  | 1544 | 315 |
| 12 | 1133 | 2645 | 423 |
| 12 | —    | 2984 | —   |

- **Output density**: ≈ 220 completion tokens per story, plus ~300–420 reasoning tokens per call at `reasoning_effort: 'low'`.
- **Extrapolation to 24 stories**: ~5,300–5,600 completion tokens, fitting within the 6,000 completion token ceiling (`maxOutputTokens: 6000`).
- **Title-only fallback**: Bounded at 3,000 completion tokens (`maxOutputTokens: 3000`).

## 2. Batch-Ceiling Reliability

With all 11 classification fields defined as nullable enums, the probability of constrained-decoding drift increases with batch size:

| Batch | Trials | Result |
|---|---|---|
| 6  | 1 | ✅ OK |
| 12 | 1 | ✅ OK |
| 12 | 4 | 1 OK, 2 × `json_validate_failed`, 1 × rate limit |
| **16** | **3** | **0 OK — 3 × `json_validate_failed`** |
| **20** | **3** | **0 OK — 3 × `json_validate_failed`** |
| **24** | **3** | **0 OK — 3 × `json_validate_failed`** |

Failures land on different fields across runs (`domain`, `changeType`, `kind`), indicating cumulative constrained-decoding drift rather than a single malformed definition. A 24-headline batch cannot carry 11 nullable enum fields reliably.

Consequently, `lib/patch-titles.mjs`:
1. Slices candidates into chunks of 12 (`COLLECTION_BATCH_SIZE = 12`).
2. On `json_validate_failed`, recursively splits multi-article batches into halves (e.g. 12 → 6 + 6) with `collectionSchema`.
3. Falls back to `titleOnlySchema` only if a single article fails validation.

## 3. Provider Error Distinctions

Groq surfaces two distinct failure modes with HTTP 400:

1. **Schema Rejected by Provider**:
   - HTTP 400 `invalid_request_error`.
   - **No `error.code` field** (i.e. `providerCode` is `null` / `undefined`).
   - Triggered when the JSON schema itself violates strict mode (e.g. properties missing from `required`).
   - Non-recoverable by retry; must fail immediately and log the schema defect.

2. **Generated Output Validation Failure**:
   - HTTP 400 with `error.code: "json_validate_failed"`.
   - The schema itself is valid, but the model's generated JSON drifted outside schema constraints.
   - Recoverable via recursive batch splitting or title-only fallback.

## 4. Nullable Enum Syntax

Strict mode requires all properties to be listed in `required`. To allow optional classification fields:
- **Valid**: `{"type": ["string", "null"], "enum": [..., null]}` with the property listed in `required`.
- **Invalid**: `{"anyOf": [{"type": "string", "enum": [...]}, {"type": "null"}]}` — accepted by the JSON schema validator, but causes the model to generate `null` for every classification field across all stories.

## 5. Rate Limits

Consecutive 6000-token calls can exceed tokens-per-minute (TPM) limits on standard tiers (`rate_limit_exceeded`). Spacing calls or relying on bounded backoff is necessary under sustained execution.
