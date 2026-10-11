// Downscales photos client-side before upload -- keeps uploads small (Nginx
// body-size limit, mobile data, the Pi's bandwidth) without needing a full
// image-processing dependency (an <img> + <canvas> round-trip is enough).
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
// Largest avatar on screen is 160px (AvatarPreviewModal); 400px keeps it
// sharp on high-DPI phones while staying around 30-60 KB.
const AVATAR_SIZE = 400;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image'));
    };
    img.src = objectUrl;
  });
}

// Used for recipe import (Claude vision wants base64, not a Blob).
export async function resizeImageFile(file, maxDimension = MAX_DIMENSION) {
  const img = await loadImage(file);
  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { media_type: 'image/jpeg', data: dataUrl.split(',')[1] };
}

// Center-crops to a square (avatars are always shown round with
// object-cover, so the cut-off edges were never visible anyway) and scales
// down to AVATAR_SIZE. Returns a JPEG File ready for multipart upload.
export async function resizeAvatarFile(file, size = AVATAR_SIZE) {
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  const target = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, target, target);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', JPEG_QUALITY)
  );
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
