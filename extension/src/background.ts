import { createClerkClient } from '@clerk/chrome-extension/background'

// Vite exposes env variables starting with VITE_ to the client
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Never crash the entire background worker if auth env vars are missing.
// Capture/messaging must keep working even before auth is configured.
export const clerk = PUBLISHABLE_KEY
  ? createClerkClient({ publishableKey: PUBLISHABLE_KEY })
  : null;

if (!PUBLISHABLE_KEY) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY is missing. Auth is disabled in background.');
}

// This is required to keep the service worker alive
chrome.runtime.onInstalled.addListener(() => {
  console.log('OryxSolver installed, Clerk Auth initialized.')
});

type CropRectPayload = {
  x: number;
  y: number;
  width: number;
  height: number;
  dpr: number;
};

function injectCropOverlay() {
  const existing = document.getElementById('oryx-crop-overlay-root');
  if (existing) existing.remove();

  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const root = document.createElement('div');
  root.id = 'oryx-crop-overlay-root';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '2147483647';
  root.style.background = 'rgba(15, 23, 42, 0.35)';
  root.style.cursor = 'crosshair';
  root.style.userSelect = 'none';

  const hint = document.createElement('div');
  hint.textContent = 'Drag to capture area. Press Esc to cancel.';
  hint.style.position = 'fixed';
  hint.style.top = '16px';
  hint.style.left = '50%';
  hint.style.transform = 'translateX(-50%)';
  hint.style.padding = '8px 12px';
  hint.style.borderRadius = '10px';
  hint.style.background = 'rgba(2, 6, 23, 0.85)';
  hint.style.color = '#e2e8f0';
  hint.style.fontSize = '12px';
  hint.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
  root.appendChild(hint);

  const selection = document.createElement('div');
  selection.style.position = 'absolute';
  selection.style.display = 'none';
  selection.style.border = '2px solid #6366f1';
  selection.style.background = 'rgba(99, 102, 241, 0.15)';
  selection.style.boxShadow = '0 0 0 99999px rgba(15, 23, 42, 0.35)';
  root.appendChild(selection);

  const cleanup = () => {
    window.removeEventListener('keydown', onKeydown);
    root.remove();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'CROP_SELECTION_CANCELLED' });
    }
  };

  const updateSelection = (currentX: number, currentY: number) => {
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selection.style.left = `${left}px`;
    selection.style.top = `${top}px`;
    selection.style.width = `${width}px`;
    selection.style.height = `${height}px`;
  };

  root.addEventListener('mousedown', (event) => {
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    selection.style.display = 'block';
    updateSelection(startX, startY);
  });

  root.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    updateSelection(event.clientX, event.clientY);
  });

  root.addEventListener('mouseup', (event) => {
    if (!isDragging) return;
    isDragging = false;

    const left = Math.min(startX, event.clientX);
    const top = Math.min(startY, event.clientY);
    const width = Math.abs(event.clientX - startX);
    const height = Math.abs(event.clientY - startY);

    cleanup();

    if (width < 8 || height < 8) {
      chrome.runtime.sendMessage({ type: 'CROP_SELECTION_CANCELLED' });
      return;
    }

    chrome.runtime.sendMessage({
      type: 'CROP_RECT_SELECTED',
      payload: {
        x: left,
        y: top,
        width,
        height,
        dpr: window.devicePixelRatio || 1,
      },
    });
  });

  window.addEventListener('keydown', onKeydown);
  document.documentElement.appendChild(root);
}

async function cropImageDataUrl(
  imageDataUrl: string,
  rect: CropRectPayload,
): Promise<string> {
  const sourceBlob = await (await fetch(imageDataUrl)).blob();
  const sourceBitmap = await createImageBitmap(sourceBlob);

  const cropWidth = Math.max(1, Math.floor(rect.width * rect.dpr));
  const cropHeight = Math.max(1, Math.floor(rect.height * rect.dpr));
  const sx = Math.max(0, Math.floor(rect.x * rect.dpr));
  const sy = Math.max(0, Math.floor(rect.y * rect.dpr));

  const canvas = new OffscreenCanvas(cropWidth, cropHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create drawing context for crop.');
  }

  ctx.drawImage(sourceBitmap, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to convert cropped image to data URL.'));
    reader.readAsDataURL(croppedBlob);
  });
}

async function getActiveTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'CAPTURE_VISIBLE_TAB') {
        const activeTab = await getActiveTab();
        if (!activeTab?.windowId) {
          sendResponse({ ok: false, error: 'No active tab found.' });
          return;
        }

        const imageDataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
          format: 'png',
        });

        sendResponse({ ok: true, imageDataUrl });
        return;
      }

      if (message?.type === 'START_CROP_CAPTURE') {
        const activeTab = await getActiveTab();
        if (!activeTab?.id) {
          sendResponse({ ok: false, error: 'No active tab found.' });
          return;
        }

        // First try the statically loaded content script route.
        try {
          await chrome.tabs.sendMessage(activeTab.id, { type: 'SHOW_CROP_OVERLAY' });
        } catch {
          // If no receiving content script exists on this tab, inject fallback overlay.
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: injectCropOverlay,
          });
        }

        sendResponse({ ok: true });
        return;
      }

      if (message?.type === 'CROP_RECT_SELECTED') {
        const rect = message.payload as CropRectPayload;
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          throw new Error('Invalid crop selection.');
        }

        const windowId = sender.tab?.windowId ?? (await getActiveTab())?.windowId;
        if (!windowId) {
          throw new Error('No active tab window found for crop capture.');
        }

        const fullImageDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        const croppedImageDataUrl = await cropImageDataUrl(fullImageDataUrl, rect);

        await chrome.runtime.sendMessage({
          type: 'CROP_CAPTURE_READY',
          imageDataUrl: croppedImageDataUrl,
        });
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === 'CROP_SELECTION_CANCELLED') {
        await chrome.runtime.sendMessage({
          type: 'CROP_CAPTURE_ERROR',
          error: 'Capture cancelled.',
        });
        sendResponse({ ok: true });
        return;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Background capture error';
      sendResponse({ ok: false, error: errorMessage });
    }
  })();

  return true;
});
