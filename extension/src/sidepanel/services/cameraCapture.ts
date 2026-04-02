import { MSG_CAPTURE_VISIBLE_TAB, MSG_START_CROP_CAPTURE, MSG_CROP_CAPTURE_READY, MSG_CROP_CAPTURE_ERROR } from '../../shared/messageTypes';

type CaptureVisibleTabResponse = {
  ok: boolean;
  imageDataUrl?: string;
  error?: string;
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

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

function timestampedCaptureName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `oryx-capture-${timestamp}.png`;
}

export async function captureVisibleTabToFile(): Promise<File> {
  let response: CaptureVisibleTabResponse;
  try {
    response = (await chrome.runtime.sendMessage({
      type: MSG_CAPTURE_VISIBLE_TAB,
    })) as CaptureVisibleTabResponse;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Could not capture screen.');
  }

  if (!response?.ok || !response.imageDataUrl) {
    throw new Error(response?.error || 'Could not capture screen.');
  }

  return dataUrlToFile(response.imageDataUrl, timestampedCaptureName());
}

export async function captureCroppedAreaToFile(): Promise<File> {
  let startResponse: CaptureVisibleTabResponse;
  try {
    startResponse = (await chrome.runtime.sendMessage({
      type: MSG_START_CROP_CAPTURE,
    })) as CaptureVisibleTabResponse;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Could not start crop capture.');
  }

  if (!startResponse?.ok) {
    return captureVisibleTabToFile();
  }

  return await new Promise<File>((resolve, reject) => {
    const timeoutMs = 8000;

    const cleanup = () => {
      clearTimeout(timeoutId);
      chrome.runtime.onMessage.removeListener(listener);
    };

    const listener = (message: { type?: string; imageDataUrl?: string; error?: string }) => {
      if (message?.type === MSG_CROP_CAPTURE_READY && message.imageDataUrl) {
        cleanup();
        dataUrlToFile(message.imageDataUrl, timestampedCaptureName())
          .then(resolve)
          .catch(reject);
        return;
      }

      if (message?.type === MSG_CROP_CAPTURE_ERROR) {
        cleanup();
        const errorText = message.error || 'Crop capture failed.';
        if (/cancel/i.test(errorText)) {
          reject(new Error('Capture cancelled.'));
          return;
        }
        captureVisibleTabToFile().then(resolve).catch(() => reject(new Error(errorText)));
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    const timeoutId = setTimeout(() => {
      cleanup();
      captureVisibleTabToFile().then(resolve).catch(reject);
    }, timeoutMs);
  });
}
