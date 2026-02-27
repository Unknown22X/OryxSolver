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
  const response = (await chrome.runtime.sendMessage({
    type: 'CAPTURE_VISIBLE_TAB',
  })) as CaptureVisibleTabResponse;

  if (!response?.ok || !response.imageDataUrl) {
    throw new Error(response?.error || 'Could not capture screen.');
  }

  return dataUrlToFile(response.imageDataUrl, timestampedCaptureName());
}

export async function captureCroppedAreaToFile(): Promise<File> {
  const startResponse = (await chrome.runtime.sendMessage({
    type: 'START_CROP_CAPTURE',
  })) as CaptureVisibleTabResponse;

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
      if (message?.type === 'CROP_CAPTURE_READY' && message.imageDataUrl) {
        cleanup();
        dataUrlToFile(message.imageDataUrl, timestampedCaptureName())
          .then(resolve)
          .catch(reject);
        return;
      }

      if (message?.type === 'CROP_CAPTURE_ERROR') {
        cleanup();
        reject(new Error(message.error || 'Crop capture failed.'));
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    const timeoutId = setTimeout(() => {
      cleanup();
      captureVisibleTabToFile().then(resolve).catch(reject);
    }, timeoutMs);
  });
}
