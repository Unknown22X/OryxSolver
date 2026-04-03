/**
 * Client-side image compression to reduce AI vision costs and upload time.
 *
 * Strategy:
 * - Resize long edge to MAX_DIMENSION
 * - Convert to JPEG with QUALITY for screenshots/photos
 * - Skip small files to preserve quality and reduce CPU work
 */

const MAX_DIMENSION = 1600;
const QUALITY = 0.8;
const SIZE_THRESHOLD = 900 * 1024; // 900KB

function createCanvas(width: number, height: number): {
  draw: (bitmap: ImageBitmap) => void;
  toBlob: () => Promise<Blob | null>;
} | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return {
      draw: (bitmap: ImageBitmap) => {
        ctx.drawImage(bitmap, 0, 0, width, height);
      },
      toBlob: () => canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY }),
    };
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return {
      draw: (bitmap: ImageBitmap) => {
        ctx.drawImage(bitmap, 0, 0, width, height);
      },
      toBlob: () =>
        new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', QUALITY);
        }),
    };
  }

  return null;
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= SIZE_THRESHOLD) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    if (Math.max(width, height) <= MAX_DIMENSION) {
      bitmap.close();
      return file;
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const nextWidth = Math.round(width * scale);
    const nextHeight = Math.round(height * scale);
    const canvas = createCanvas(nextWidth, nextHeight);
    if (!canvas) {
      bitmap.close();
      return file;
    }

    canvas.draw(bitmap);
    bitmap.close();

    const compressedBlob = await canvas.toBlob();
    if (!compressedBlob || compressedBlob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([compressedBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('[webapp] Image compression failed, using original image', error);
    return file;
  }
}

export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file)));
}

