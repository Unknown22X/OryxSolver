import "./instrument";
// Background script handles side panel behavior and capture messaging.
import {
  MSG_CAPTURE_VISIBLE_TAB, MSG_START_CROP_CAPTURE, MSG_SHOW_CROP_OVERLAY,
  MSG_CROP_RECT_SELECTED, MSG_CROP_SELECTION_CANCELLED, MSG_CROP_CAPTURE_READY,
  MSG_CROP_CAPTURE_ERROR, MSG_EXTRACT_PAGE_CONTEXT,
  MSG_INLINE_EXTRACT_QUESTION, MSG_INLINE_SOLVE_AND_INJECT
} from './shared/messageTypes';
import {
  sanitizePendingInlineQuestion,
  savePendingInlineQuestion,
} from './shared/inlineQuestionStore';
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
  void configureSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanelBehavior();
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab.windowId) return;
    if (isInjectableTab(tab)) {
      await ensureContentScripts(tab.id);
    }
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

function isOwnExtensionSender(sender: chrome.runtime.MessageSender) {
  return !sender.id || sender.id === chrome.runtime.id;
}

function isExtensionPageSender(sender: chrome.runtime.MessageSender) {
  return isOwnExtensionSender(sender) && !sender.tab;
}

function isContentScriptSender(sender: chrome.runtime.MessageSender) {
  return isOwnExtensionSender(sender) && typeof sender.tab?.id === 'number';
}

function isInjectableUrl(url: string | undefined) {
  if (!url) return false;
  return !/^(about|chrome|chrome-extension|devtools|edge|moz-extension|view-source):/i.test(url);
}

function isInjectableTab(tab: chrome.tabs.Tab | undefined | null): tab is chrome.tabs.Tab & { id: number } {
  return Boolean(tab && typeof tab.id === 'number' && isInjectableUrl(tab.url));
}

async function getInjectableActiveTab() {
  const activeTab = await getActiveTab();
  if (!isInjectableTab(activeTab)) {
    throw new Error('Open a standard webpage before using this feature.');
  }
  return activeTab;
}

async function ensureContentScripts(tabId: number, files?: string[]) {
  const scriptFiles =
    files && files.length > 0
      ? files
      : chrome.runtime.getManifest().content_scripts?.flatMap((entry) => entry.js ?? []) ?? [];
  if (scriptFiles.length === 0) {
    throw new Error('No content script files configured in manifest.');
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: scriptFiles,
  });
}

// ======================================
// === background message entry point ===
// ======================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === MSG_CAPTURE_VISIBLE_TAB) {
        if (!isExtensionPageSender(sender)) {
          sendResponse({ ok: false, error: 'Unauthorized sender.' });
          return;
        }

        const activeTab = await getInjectableActiveTab();
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

      if (message?.type === MSG_START_CROP_CAPTURE) {
        if (!isExtensionPageSender(sender)) {
          sendResponse({ ok: false, error: 'Unauthorized sender.' });
          return;
        }

        const activeTab = await getInjectableActiveTab();
        if (!activeTab?.id) {
          sendResponse({ ok: false, error: 'No active tab found.' });
          return;
        }

        try {
          await chrome.tabs.sendMessage(activeTab.id, { type: MSG_SHOW_CROP_OVERLAY });
        } catch (error) {
          const messageText = error instanceof Error ? error.message : String(error);
          if (!messageText.includes('Receiving end does not exist')) {
            throw error;
          }
          await ensureContentScripts(activeTab.id, ['src/content/cropOverlay.ts']);
          await chrome.tabs.sendMessage(activeTab.id, { type: MSG_SHOW_CROP_OVERLAY });
        }

        sendResponse({ ok: true });
        return;
      }

      if (message?.type === MSG_EXTRACT_PAGE_CONTEXT) {
        if (!isExtensionPageSender(sender)) {
          sendResponse({ ok: false, error: 'Unauthorized sender.' });
          return;
        }

        const activeTab = await getInjectableActiveTab();
        if (!activeTab?.id) {
          sendResponse({ ok: false, error: 'No active tab found.' });
          return;
        }
        
        try {
          const response = await chrome.tabs.sendMessage(activeTab.id, { type: MSG_EXTRACT_PAGE_CONTEXT });
          sendResponse(response);
        } catch (error) {
           const messageText = error instanceof Error ? error.message : String(error);
           if (messageText.includes('Receiving end does not exist')) {
             try {
               await ensureContentScripts(activeTab.id, ['src/content/domExtractor.ts']);
               const response = await chrome.tabs.sendMessage(activeTab.id, { type: MSG_EXTRACT_PAGE_CONTEXT });
               sendResponse(response);
               return;
             } catch (retryError) {
               const retryText = retryError instanceof Error ? retryError.message : String(retryError);
               sendResponse({ ok: false, error: retryText });
               return;
             }
           }
           sendResponse({ ok: false, error: messageText });
        }
        return;
      }

      if (message?.type === MSG_INLINE_EXTRACT_QUESTION || message?.type === MSG_INLINE_SOLVE_AND_INJECT) {
        if (!isContentScriptSender(sender) || !sender.tab?.id) {
          sendResponse({ ok: false, error: 'Unauthorized sender.' });
          return;
        }

        const pendingQuestion = sanitizePendingInlineQuestion({
          type: message.type,
          text: message.payload?.text,
          images: message.payload?.images,
          injectionId: message.payload?.injectionId,
          isBulk: message.payload?.isBulk,
          timestamp: Date.now(),
          tabId: sender.tab.id,
        });

        if (!pendingQuestion) {
          sendResponse({ ok: false, error: 'Invalid inline question payload.' });
          return;
        }

        const windowId = sender.tab.windowId;
        if (windowId) {
          try {
            await chrome.sidePanel.open({ windowId });
          } catch (e) {
            console.warn('Failed to open sidepanel:', e);
          }
        }
        await savePendingInlineQuestion(pendingQuestion);
        // We still send response and let the content script continue
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === MSG_CROP_RECT_SELECTED) {
        if (!isContentScriptSender(sender)) {
          sendResponse({ ok: false, error: 'Unauthorized sender.' });
          return;
        }

        const rect = message.payload as CropRectPayload;
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          throw new Error('Invalid crop selection.');
        }

        const windowId = sender.tab?.windowId;
        if (!windowId) {
          throw new Error('No active tab window found for crop capture.');
        }

        const fullImageDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        const croppedImageDataUrl = await cropImageDataUrl(fullImageDataUrl, rect);

        await chrome.runtime.sendMessage({
          type: MSG_CROP_CAPTURE_READY,
          imageDataUrl: croppedImageDataUrl,
        });
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === MSG_CROP_SELECTION_CANCELLED) {
        if (!isContentScriptSender(sender)) {
          sendResponse({ ok: false, error: 'Unauthorized sender.' });
          return;
        }

        await chrome.runtime.sendMessage({
          type: MSG_CROP_CAPTURE_ERROR,
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
