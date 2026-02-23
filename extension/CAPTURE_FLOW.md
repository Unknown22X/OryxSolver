# OryxSolver Capture Flow (Camera + Crop)

This document explains, in detail, how screenshot capture works in the extension today, why each part exists, and how data moves from UI to API.

## 1. High-level architecture

There are 4 places involved:

1. `sidepanel` UI
- File: `extension/src/sidepanel/components/MessageComposer.tsx`
- User clicks camera button.

2. `sidepanel` orchestration + API send
- File: `extension/src/sidepanel/App.tsx`
- Requests capture, receives a `File`, sends `{ question + image }` via `FormData`.

3. background service worker
- File: `extension/src/background.ts`
- Coordinates crop start, captures visible tab, crops image, broadcasts result.

4. page overlay
- File: `extension/src/content/cropOverlay.ts`
- Renders drag-to-select rectangle and reports selected coordinates.

---

## 2. Manifest requirements

File: `extension/manifest.json`

Important keys:

- `"background"`: service worker entry
- `"content_scripts"`: loads crop overlay listener on pages
- `"permissions"` includes:
  - `activeTab` (capture current tab)
  - `tabs` (query active tab)
  - `scripting` (inject fallback crop overlay)
- `"host_permissions"` includes `"<all_urls>"` so overlay/capture works on normal sites.

Without these permissions, crop box or capture can silently fail.

---

## 3. Runtime message protocol

### 3.1 Sidepanel starts crop

`MessageComposer.tsx` camera button calls `onCaptureScreen`.

`App.tsx` uses:
- `captureCroppedAreaToFile()` from `sidepanel/services/cameraCapture.ts`

`cameraCapture.ts` sends:
- `START_CROP_CAPTURE` -> background

### 3.2 Background starts overlay

In `background.ts`:

- Finds active tab.
- Tries `chrome.tabs.sendMessage(tabId, { type: 'SHOW_CROP_OVERLAY' })` first.
- If no receiver exists, fallback injects overlay directly with `chrome.scripting.executeScript(... injectCropOverlay ...)`.

This dual path was added because some tabs did not receive preloaded content-script messages reliably.

### 3.3 User drags crop region

Overlay (content script or injected function) tracks:
- `mousedown`: start coordinates
- `mousemove`: rectangle update
- `mouseup`: finalize rectangle
- `Escape`: cancel

On finalize, sends:
- `CROP_RECT_SELECTED` with `{ x, y, width, height, dpr }`

On cancel or tiny box:
- `CROP_SELECTION_CANCELLED`

### 3.4 Background captures and crops

On `CROP_RECT_SELECTED` in `background.ts`:

1. `chrome.tabs.captureVisibleTab(windowId, { format: 'png' })`
2. `cropImageDataUrl(...)`:
- converts data URL to blob
- creates `ImageBitmap`
- computes pixel-space crop using `dpr`
- draws crop to `OffscreenCanvas`
- exports cropped blob as PNG data URL
3. sends runtime message:
- `CROP_CAPTURE_READY` with `imageDataUrl`

On cancel:
- sends `CROP_CAPTURE_ERROR`

### 3.5 Sidepanel receives cropped image

In `cameraCapture.ts`:

- `captureCroppedAreaToFile()` waits for:
  - `CROP_CAPTURE_READY` -> converts data URL to `File`
  - `CROP_CAPTURE_ERROR` -> throws
- timeout fallback (~8s): if crop never returns, auto fallback to full-screen capture using `captureVisibleTabToFile()`.

This guarantees camera action returns an image in most cases.

---

## 4. Code walkthrough by file

## 4.1 `extension/src/sidepanel/components/MessageComposer.tsx`

Responsibilities:
- input text state
- selected image state
- manual file upload button (`Paperclip`)
- camera capture button (`Camera`)
- send button

Key behavior:
- camera click sets user hint: `Draw a box on the page to capture...`
- waits for `onCaptureScreen()` Promise
- if file returned, stores in `selectedImage`
- send emits `{ text, image }` to parent

This component is intentionally UI-focused only.

## 4.2 `extension/src/sidepanel/App.tsx`

Responsibilities:
- orchestration + error state
- calls `captureCroppedAreaToFile()`
- submits to API with `FormData`

Important logic:
- `handleCaptureScreen()` wraps capture service and writes `sendError` on failure
- `handleSend()` builds multipart payload:
  - `question` (text)
  - `image` (optional file)

Do not set `Content-Type` manually for multipart; browser sets boundary.

## 4.3 `extension/src/sidepanel/services/cameraCapture.ts`

Responsibilities:
- sidepanel capture client
- convert data URL to `File`
- manage runtime response listener lifecycle

Important functions:
- `captureVisibleTabToFile()`
- `captureCroppedAreaToFile()`
- `dataUrlToFile(...)`

Resilience features:
- If crop start fails: fallback full-screen capture.
- If crop result never arrives: timeout then fallback full-screen capture.

## 4.4 `extension/src/background.ts`

Responsibilities:
- central capture/crop controller
- safe startup even when Clerk env is missing

Important improvement:
- background no longer throws when `VITE_CLERK_PUBLISHABLE_KEY` missing.
- It logs warning and keeps capture pipeline alive.

Capture handlers implemented:
- `CAPTURE_VISIBLE_TAB`
- `START_CROP_CAPTURE`
- `CROP_RECT_SELECTED`
- `CROP_SELECTION_CANCELLED`

## 4.5 `extension/src/content/cropOverlay.ts`

Responsibilities:
- show crop UI on webpage
- collect drag rectangle
- emit selection/cancel events

Notes:
- This exists as the primary content-script path.
- Background also has direct injection fallback (`injectCropOverlay`) for reliability.

---

## 5. Crop math details

Inputs from overlay are CSS pixels:
- `x`, `y`, `width`, `height`

Screenshots from `captureVisibleTab` are device pixels.

So in `background.ts`, conversion is:
- `sx = x * dpr`
- `sy = y * dpr`
- `cropWidth = width * dpr`
- `cropHeight = height * dpr`

This avoids blurry or offset crops on high-DPI displays.

---

## 6. Why it failed before and why it now works

Root issues that were fixed:

1. Background worker crash risk
- Throwing on missing Clerk key could stop all runtime messaging.
- Fixed by making Clerk optional and non-fatal.

2. Overlay start fragility
- Depending only on content-script message could fail on some tabs.
- Fixed by adding fallback injection via `chrome.scripting.executeScript`.

3. Silent UX on failure
- User saw no visual result.
- Fixed with capture status hints and fallback-to-fullscreen behavior.

---

## 7. Current limitations

1. Restricted pages still block behavior
- Examples: `chrome://*`, Chrome Web Store pages.

2. No resize handles / re-edit after draw
- Current UX is single drag, one-shot.

3. Full-screen fallback may trigger when crop doesn’t complete
- Intentional for reliability.

---

## 8. Suggested next improvements

1. Replace duplicate overlay implementations
- Keep one source of truth (either content script only or injected only).

2. Add explicit toast for fallback mode
- Example: `Crop unavailable, used full screenshot.`

3. Add visual polish
- selection corner handles
- min-size indicator
- dimmed outside region with cleaner mask

4. Add telemetry/debug logs
- Useful for diagnosing page-specific failures.

---

## 9. Quick debug checklist

When camera appears broken:

1. Verify extension was reloaded after code changes.
2. Refresh target webpage tab.
3. Check `chrome://extensions` service worker errors.
4. Confirm page is not restricted (`chrome://`, web store).
5. Confirm manifest has `tabs`, `activeTab`, `scripting`, `<all_urls>`.

---

## 10. Files involved (reference)

- `extension/manifest.json`
- `extension/src/background.ts`
- `extension/src/content/cropOverlay.ts`
- `extension/src/sidepanel/services/cameraCapture.ts`
- `extension/src/sidepanel/components/MessageComposer.tsx`
- `extension/src/sidepanel/App.tsx`
