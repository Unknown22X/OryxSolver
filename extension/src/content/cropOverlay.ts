let overlayRoot: HTMLDivElement | null = null;
let selectionBox: HTMLDivElement | null = null;
let isDragging = false; // true when mouse is pressed , false when it is released
let startX = 0; // x-coord where first clicked
let startY = 0; // the same but for y

function cleanupOverlay() {
  window.removeEventListener('keydown', handleKeydown);
  if (overlayRoot) {
    overlayRoot.remove();
    overlayRoot = null;
  }
  selectionBox = null;
  isDragging = false;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    cleanupOverlay();
    chrome.runtime.sendMessage({ type: 'CROP_SELECTION_CANCELLED' });
  }
}

function updateSelectionBox(currentX: number, currentY: number) {
  if (!selectionBox) return;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

function createOverlay() {
  cleanupOverlay();

  overlayRoot = document.createElement('div');
  overlayRoot.id = 'oryx-crop-overlay';
  overlayRoot.style.position = 'fixed';
  overlayRoot.style.inset = '0';
  overlayRoot.style.zIndex = '2147483647';
  overlayRoot.style.background = 'rgba(15, 23, 42, 0.35)';
  overlayRoot.style.cursor = 'crosshair';
  overlayRoot.style.userSelect = 'none';

  const hint = document.createElement('div');
  hint.textContent = 'Drag to capture area. Press Esc to cancel.';
  hint.style.position = 'fixed';
  hint.style.top = '16px';
  hint.style.left = '50%';
  hint.style.transform = 'translateX(-50%)';
  hint.style.padding = '8px 12px';
  hint.style.borderRadius = '10px';
  hint.style.background = 'rgba(2, 6, 23, 0.8)';
  hint.style.color = '#e2e8f0';
  hint.style.fontSize = '12px';
  hint.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
  hint.style.pointerEvents = 'none';
  overlayRoot.appendChild(hint);

  selectionBox = document.createElement('div');
  selectionBox.style.position = 'absolute';
  selectionBox.style.border = '2px solid #6366f1';
  selectionBox.style.background = 'rgba(99, 102, 241, 0.15)';
  selectionBox.style.boxShadow = '0 0 0 99999px rgba(15, 23, 42, 0.35)';
  selectionBox.style.display = 'none';
  overlayRoot.appendChild(selectionBox);

  overlayRoot.addEventListener('mousedown', (event) => {
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;

    if (!selectionBox) return;
    selectionBox.style.display = 'block';
    updateSelectionBox(startX, startY);
  });

  overlayRoot.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    updateSelectionBox(event.clientX, event.clientY);
  });

  overlayRoot.addEventListener('mouseup', async (event) => {
    if (!isDragging) return;
    isDragging = false;

    const left = Math.min(startX, event.clientX);
    const top = Math.min(startY, event.clientY);
    const width = Math.abs(event.clientX - startX);
    const height = Math.abs(event.clientY - startY);

    cleanupOverlay();

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

  document.documentElement.appendChild(overlayRoot);
  window.addEventListener('keydown', handleKeydown);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'SHOW_CROP_OVERLAY') {
    createOverlay();
  }
});
