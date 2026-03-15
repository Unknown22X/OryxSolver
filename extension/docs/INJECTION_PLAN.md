# OryxSolver Inline Injection & Extraction Plan
*Status: Initial Planning*

This document outlines the architecture and approach for the **DOM Extraction and Inline Injection** system (Phase E & F). This allows the extension to tightly integrate with the webpage, identify questions, and inject answers or quick-solve actions directly into the workflow of platforms like Canvas, Google Forms, and Microsoft Forms.

## Core Features & Concepts

### 1. The "Inline Logo Solving" (Injection)
When a user opens a quiz or assignment, the script will:
- Parse the DOM for elements that structurally look like questions (e.g., standard Canvas form questions, Google Forms titles).
- Inject a small, floating **Oryx Logo (`<button>`)** adjacent to the question text.
- Clicking the logo will:
  1. Capture only that specific question block's text context.
  2. Send it directly to the cloud background script for a stealth solve.
  3. Morph the logo footprint into a **mini pop-down tooltip** revealing the correct answer directly inline.

### 2. Highlighting Quick-Solve (Extraction)
If the extension cannot automatically decipher the structure of an obscure website:
- A user can manually drag and **highlight text**.
- We listen for `mouseup` and `selection` events.
- A floating "Solve Highlighted" popup appears right above their cursor. 
- Clicking it immediately populates the side panel with that exact problem context.

### 3. Copy/Solve "All Questions On Page" (Extraction)
- The extension will expose an action (either in the Side Panel or via context menu) to `Extract whole page context`.
- The Injection Script iterates the full page, mapping out an array of grouped question/answer pairs and bundles them into a master JSON blob.
- Users can choose to instantly dump all page questions into their clipboard OR inject answers progressively for all recognized fields.

### 4. Direct Form Auto-Fill (Bonus Difference-Maker)
For maximum "wow" factor:
- If we confidently recognize the question input type (e.g. standard radio buttons for multiple-choice, or a text area for short answer), clicking the Oryx Logo does not just present the answer inline—**it will physically simulate a native click / fill to answer the question for the user.** 
  - *Note: This requires careful event dispatching to ensure the site's React/Vue state recognizes the change (`Event('input', { bubbles: true })`).*

---

## Technical Architecture

### **A. `src/content/domExtractor.ts` (Existing, to be upgraded)**
- Responsible for **Extraction Algorithms**.
- Contains specific parsing logic for `<div class="question">` (Canvas) and `<div role="heading">` (Google Forms).
- Listens for background messages requesting the master context.

### **B. `src/content/inlineInjector.ts` (New Script)**
- Responsible for **DOM Modification**.
- Contains the `MutationObserver` that watches for new questions rendering.
- Re-runs injections safely without duplicates.
- Creates Shadow DOM elements for the Oryx Logo so the website's native CSS cannot ruin our styling or tracking.

### **C. `src/content/highlightMenu.ts` (New Script)**
- Standard utility that bounds selection rects and renders the floating menu specifically for manual text highlights.

---

## Next Steps for Implementation
1. Develop `inlineInjector.ts` starting with Google Forms as the fundamental proving ground.
2. Build the Shadow DOM UI for the floating Oryx Logo.
3. Wire the onClick handler of the Logo to send a direct message to `background.ts` to trigger a solve.
4. Render the inline tooltip with the response.
