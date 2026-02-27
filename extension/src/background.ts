import { createClerkClient } from '@clerk/chrome-extension/background'

// =========================
// === auth + clerk init ===
// =========================

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const clerk = PUBLISHABLE_KEY
  ? createClerkClient({ publishableKey: PUBLISHABLE_KEY }) // to get a new token for the user
  : null;

if (!PUBLISHABLE_KEY) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY is missing. Auth is disabled in background.');
}

export async function getToken() {
  if (!clerk) {
    return null;
  }

  const clerkClient = await clerk;
  if (!clerkClient.session) {
    return null;
  }

  return await clerkClient.session.getToken();
}

// ==============================
// === side panel click and open  ===
// ==============================

async function configureSidePanelBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.warn('Failed to configure side panel behavior:', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('OryxSolver installed, Clerk Auth initialized.')
  void configureSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanelBehavior();
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab.windowId) return;
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.warn('Failed to open side panel on action click:', error);
  }
});

// ============================
// === capture math - helpers ===
// ============================

type CropRectPayload = {
  x: number;
  y: number;
  width: number;
  height: number;
  dpr: number;
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  if (!meta || !base64) {
    throw new Error('Invalid data URL.');
  }

  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function cropImageDataUrl(
  imageDataUrl: string,
  rect: CropRectPayload,
): Promise<string> {
  const sourceBlob = dataUrlToBlob(imageDataUrl);
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

// ======================================
// === background message entry point ===
// ======================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'GET_AUTH_TOKEN') {
        const token = await getToken();
        sendResponse({ ok: true, token });
        return;
      }

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

        await chrome.tabs.sendMessage(activeTab.id, { type: 'SHOW_CROP_OVERLAY' });

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
