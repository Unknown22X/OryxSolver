# Oryx Solver - Current Development Handoff

## What has been accomplished recently:
1. **UI Bug Fixes (Side Panel):**
   - Moved the "Upgrade to Pro" button to the `SidePanelHeader` so it sits nicely next to the usage credits.
   - Removed the floating "What does Pro include?" link entirely from `MessageComposer.tsx`.
   - Removed `max-w-2xl` width constraints and padding from the composer wrapper in `App.tsx` so the text input now stretches edge-to-edge seamlessly, anchoring perfectly to the bottom of the screen (no gaps).
   - Upgraded the AI Contextual Suggestions in the input bar (e.g. "Explain simpler", "Gen Alpha terms", "Give an example") and optimized the auto-height textarea logic.

2. **Inline Injection Script (`src/content/inlineInjector.ts`):**
   - Created a smart DOM parser and `MutationObserver` that actively watches pages.
   - Designed to auto-target questions specifically on **Microsoft Forms**, **Google Forms**, and **Canvas**. 
   - Dynamically injects an isolated (Shadow DOM) Oryx Logo next to the title of supported questions.
   - Clicking the injected Logo extracts the question text and sends it straight to the Side Panel for solving.
   - **Highlights & Extract All:** Implemented a floating "Solve Highlight" button for *any* website text highlight over 10 characters, and a floating "Copy All Questions" button at the bottom right of supported forms.

3. **Background & Manifest Settings:**
   - Hooked up `App.tsx` via `chrome.runtime.onMessage` to listen to `INLINE_EXTRACT_QUESTION` so clicking an injected logo immediately submits the prompt as standard mode.
   - Modified `manifest.json` to include `web_accessible_resources` for icons (resolving a bug where injected buttons could not load the logo image natively on other domains due to Chrome CORS/CSP limits).

## Next Session Priorities:
1. **Verify the MS Forms/Google Forms Execution:** 
   - Ensure the new injection tags successfully find and append the ShadowDOM logo into the actual live web-pages of these sites.
2. **Review Side Panel Auto-Open:**
   - Currently, if the user highlights text and clicks "Solve Highlight", they must have the side panel open to see the result. You might want to use `chrome.sidePanel.setOptions()` or `chrome.sidePanel.open()` from the background script to automatically pop the panel open.
3. **Expand the DOM Extractor:**
   - The user expressed interest in letting Oryx *solve and potentially auto-fill* answers if possible, or display small tooltips natively inside the page instead of just on the side panel. 
4. **General Polish:**
   - Fix remaining build chunk size warnings (e.g. dynamic imports) if the user brings it up.
