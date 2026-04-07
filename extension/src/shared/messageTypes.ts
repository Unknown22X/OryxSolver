/**
 * Shared message type constants for chrome.runtime messaging.
 * Used across background, content scripts, and sidepanel to prevent
 * silent failures from string typos.
 */

// --- Capture / Crop ---
export const MSG_CAPTURE_VISIBLE_TAB = 'CAPTURE_VISIBLE_TAB' as const;
export const MSG_START_CROP_CAPTURE = 'START_CROP_CAPTURE' as const;
export const MSG_SHOW_CROP_OVERLAY = 'SHOW_CROP_OVERLAY' as const;
export const MSG_CROP_RECT_SELECTED = 'CROP_RECT_SELECTED' as const;
export const MSG_CROP_SELECTION_CANCELLED = 'CROP_SELECTION_CANCELLED' as const;
export const MSG_CROP_CAPTURE_READY = 'CROP_CAPTURE_READY' as const;
export const MSG_CROP_CAPTURE_ERROR = 'CROP_CAPTURE_ERROR' as const;

// --- DOM Extraction ---
export const MSG_EXTRACT_PAGE_CONTEXT = 'EXTRACT_PAGE_CONTEXT' as const;

// --- Inline Injection ---
export const MSG_INLINE_EXTRACT_QUESTION = 'INLINE_EXTRACT_QUESTION' as const;
export const MSG_INLINE_SOLVE_AND_INJECT = 'INLINE_SOLVE_AND_INJECT' as const;
export const MSG_INLINE_SOLVE_RESULT = 'INLINE_SOLVE_RESULT' as const;
// Sent by background → sidepanel after saving a pending question to storage,
// so an already-open panel can pick it up without remounting.
export const MSG_INLINE_QUESTION_READY = 'INLINE_QUESTION_READY' as const;
export const MSG_INLINE_RESTORE_WIDGETS = 'INLINE_RESTORE_WIDGETS' as const;
