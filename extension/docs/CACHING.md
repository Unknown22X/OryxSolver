# Question Caching System

## Overview

The caching system reduces AI costs by storing answers to previously asked questions. When a user asks a question that has already been answered, the system returns the cached answer instead of calling the AI - saving money and providing instant responses.

## How It Works

### Flow Diagram

```
User Question
     │
     ▼
┌─────────────────┐
│  Normalize      │  ← Convert to lowercase, trim whitespace
│  Question       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Check Cache    │  ← Query questions_cache table
│  (DB Lookup)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  YES        NO
    │         │
    ▼         ▼
┌────────┐  ┌─────────────────┐
│ Return │  │  Call AI       │
│ Cached │  │  (Gemini)      │
│ Answer │  └────────┬────────┘
│        │           │
└────────┘           ▼
               ┌─────────────────┐
               │  Save to Cache  │
               │  (for future)  │
               └────────┬────────┘
                       │
                       ▼
               ┌─────────────┐
               │ Return AI   │
               │ Response    │
               └─────────────┘
```

### Cache Key

The cache uses **normalized question text** as the key. This means:

| Input | Normalized | Cache Works? |
|-------|------------|--------------|
| "What is 2+2?" | "what is 2+2" | ✅ |
| "what is 2 + 2 ?" | "what is 2 + 2" | ✅ |
| "WHAT IS 2+2" | "what is 2+2" | ✅ |

Normalization rules:
- Convert to lowercase
- Trim whitespace
- Replace multiple spaces with single space
- Remove trailing punctuation

## What Gets Cached

### Cached
- Text-only questions
- Questions with the same meaning (after normalization)

### NOT Cached
- Questions with images (photos, screenshots)
- Bulk questions
- Questions with attachments

Reason: Image questions require AI vision processing every time, so caching wouldn't save costs.

## Database Schema

### Table: questions_cache

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| question_normalized | text | Normalized question (unique) |
| question_text | text | Original question |
| answer | text | Cached answer |
| created_at | timestamptz | When cached |

### Index
- `idx_questions_cache_normalized` on `question_normalized` for fast lookups

## API Changes

### /solve Endpoint

The solve endpoint now includes cache information in the response:

**Cache Hit Response:**
```json
{
  "ok": true,
  "answer": "4",
  "explanation": "[This answer was retrieved from cache - asked before]",
  "metadata": {
    "model": "cache",
    "aiMode": "cached"
  },
  "steps": ["Answer retrieved from cache (no AI call needed)"]
}
```

**Cache Miss Response (normal):**
```json
{
  "ok": true,
  "answer": "4",
  "explanation": "To solve...",
  "metadata": {
    "model": "gemini-1.5-pro",
    "aiMode": "normal"
  },
  "steps": ["Step 1...", "Step 2..."]
}
```

## Cost Savings

### Before Caching
- Every question → AI API call
- Cost per question: ~$0.002 - $0.01

### After Caching
- First question → AI API call
- Repeat questions → Free (database lookup only)
- Cost per cached question: ~$0.0001 (negligible)

### Example Savings

| Scenario | Before | After |
|----------|--------|-------|
| 100 users ask "What is 2+2?" | 100 AI calls | 1 AI call + 99 cache hits |
| Cost (at $0.005/question) | $0.50 | $0.005 |

## Monitoring

To check cache performance:

```sql
-- Total cached questions
SELECT COUNT(*) FROM questions_cache;

-- Most common questions
SELECT question_text, COUNT(*) as times_asked
FROM questions_cache
GROUP BY question_text
ORDER BY times_asked DESC
LIMIT 10;
```

## Future Improvements

1. **Semantic Search** - Use embeddings to find similar questions (not just exact matches)
2. **Cache Expiry** - Remove old cache entries after X days
3. **Per-User Caching** - Optionally cache per-user for personalized answers
