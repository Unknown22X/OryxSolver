/**
 * Client-side image compression to reduce AI vision costs and upload time.
 *
 * Strategy:
 * - Resize long edge to MAX_DIMENSION (1280px)
 * - Convert to JPEG at QUALITY (0.80) for photos/screenshots
 * - Skip if already below SIZE_THRESHOLD (300KB)
 * - Preserve PNG for small text-heavy images where JPEG artifacts hurt
 */

const MAX_DIMENSION = 1280;
const QUALITY = 0.80;
const SIZE_THRESHOLD = 300 * 1024; // 300KB

/**
 * Compress an image File if it exceeds the size threshold.
 * Returns the original file if compression is not beneficial.
 */
export async function compressImage(file: File): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) return file;

  // Skip small files
  if (file.size <= SIZE_THRESHOLD) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Calculate scaled dimensions
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    // Draw to an offscreen canvas
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    // Convert to JPEG blob
    const compressedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: QUALITY,
    });

    // Only use compressed version if it's actually smaller
    if (compressedBlob.size >= file.size) return file;

    // Build a new File with a .jpg extension
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([compressedBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('[Oryx] Image compression failed, using original:', err);
    return file;
  }
}

/**
 * Compress an array of image files in parallel.
 * Non-File entries (URL objects) are passed through unchanged.
 */
export async function compressImages(
  images: (File | { url: string })[]
): Promise<(File | { url: string })[]> {
  return Promise.all(
    images.map(async (img) => {
      if (img instanceof File) return compressImage(img);
      return img; // URL-based images are handled server-side
    })
  );
}
