import { supabase } from './supabaseClient';

export type ImageServerMode = 'STORE' | 'SBASE64' | 'IMGBB';

// Default keys for ImgBB with fallback capability
const DEFAULT_IMGBB_KEYS = [
  '2d9b23dcda2793165b4c478a531e21b7',
  '6d207e02198a847aa5ad34e22333807a',
  'b074a053c89b271d4715f340bece2eb2',
  '017db588448f1025a18a002fa8cfbe9a'
];

export interface ImgBBUploadResult {
  url: string;
  displayUrl: string;
  deleteUrl?: string;
  title?: string;
  modeUsed?: ImageServerMode;
}

/**
 * Get current saved image server mode preference from localStorage.
 * Defaults to 'STORE' (Supabase Storage) for reliability.
 */
export function getImageServerMode(): ImageServerMode {
  const savedMode = localStorage.getItem('image_server_mode') as ImageServerMode;
  if (savedMode && ['STORE', 'SBASE64', 'IMGBB'].includes(savedMode)) {
    return savedMode;
  }
  return 'STORE';
}

/**
 * Save image server mode preference to localStorage.
 */
export function setImageServerMode(mode: ImageServerMode): void {
  localStorage.setItem('image_server_mode', mode);
}

/**
 * Convert image file or blob directly into an optimized Base64 data URL.
 * Resizes large images to fit within maxWidth/maxHeight to optimize payload size.
 */
export async function fileToBase64Compressed(
  file: File | Blob, 
  maxWidth = 1920, 
  maxHeight = 1920, 
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không thể đọc tệp hình ảnh"));
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error("Lỗi chuyển đổi dữ liệu ảnh sang Base64"));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Tệp hình ảnh không hợp lệ hoặc bị hỏng"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize down if image exceeds dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          // Fallback to raw base64 string if canvas context unavailable
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload image to Supabase Storage candidate buckets ('resources', 'forum', 'public', 'images', 'uploads', 'files').
 */
export async function uploadToSupabaseStore(file: File | Blob): Promise<ImgBBUploadResult> {
  const fileExt = file instanceof File ? (file.name.split('.').pop() || 'png') : 'png';
  const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
  
  const candidateBuckets = ['resources', 'uploads', 'vdc', 'images', 'public', 'forum', 'files'];
  const candidatePaths = [`uploads/${fileName}`, `vdc/${fileName}`, `${fileName}`, `images/${fileName}`];
  let lastError: any = null;

  for (const bucket of candidateBuckets) {
    for (const path of candidatePaths) {
      try {
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: '3600',
          upsert: true
        });

        if (!error) {
          const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
          if (publicUrl) {
            return {
              url: publicUrl,
              displayUrl: publicUrl,
              title: file instanceof File ? file.name : 'image',
              modeUsed: 'STORE'
            };
          }
        } else {
          lastError = error;
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw new Error(`Lỗi Supabase Storage: ${lastError?.message || 'Chưa khởi tạo Storage Bucket hoặc chưa cấp quyền truy cập'}.`);
}

/**
 * Direct upload to ImgBB with fallback key iteration.
 */
export async function uploadToImgBBDirect(
  file: File | Blob, 
  customApiKey?: string
): Promise<ImgBBUploadResult> {
  const configuredKey = customApiKey || localStorage.getItem('imgbb_api_key');
  const keysToTry = configuredKey ? [configuredKey, ...DEFAULT_IMGBB_KEYS] : DEFAULT_IMGBB_KEYS;

  let lastError: Error | null = null;

  for (const apiKey of keysToTry) {
    if (!apiKey) continue;
    try {
      const formData = new FormData();
      formData.append('key', apiKey);
      formData.append('image', file);

      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.success && data.data) {
          const directUrl = data.data.display_url || data.data.url;
          return {
            url: directUrl,
            displayUrl: directUrl,
            deleteUrl: data.data.delete_url,
            title: data.data.title || 'image',
            modeUsed: 'IMGBB'
          };
        }
      } else {
        const errorText = await response.text();
        console.warn(`ImgBB upload failed with key ${apiKey.substring(0, 6)}...:`, errorText);
      }
    } catch (err: any) {
      console.warn(`ImgBB network error with key ${apiKey.substring(0, 6)}...:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Không thể tải ảnh lên máy chủ ImgBB. Vui lòng kiểm tra lại kết nối hoặc đổi phương thức STORE / SBASE64.");
}

/**
 * Flexible image uploader supporting STORE (Supabase Storage), SBASE64 (Base64 data URL), and IMGBB (ImgBB API).
 */
export async function uploadImageFlexible(
  file: File | Blob,
  mode?: ImageServerMode,
  customApiKey?: string
): Promise<ImgBBUploadResult & { modeUsed: ImageServerMode }> {
  const selectedMode = mode || getImageServerMode();

  if (selectedMode === 'SBASE64') {
    const base64Url = await fileToBase64Compressed(file);
    return {
      url: base64Url,
      displayUrl: base64Url,
      title: file instanceof File ? file.name : 'image',
      modeUsed: 'SBASE64'
    };
  }

  if (selectedMode === 'STORE') {
    try {
      const res = await uploadToSupabaseStore(file);
      return { ...res, modeUsed: 'STORE' };
    } catch (err: any) {
      console.error("STORE upload failed:", err);
      throw new Error(`Không thể tải ảnh lên Supabase Storage (STORE): ${err.message || 'Lỗi lưu trữ'}. Bạn có thể thử lại hoặc chọn phương thức SBASE64 / IMGBB.`);
    }
  }

  // IMGBB Mode
  try {
    const res = await uploadToImgBBDirect(file, customApiKey);
    return { ...res, modeUsed: 'IMGBB' };
  } catch (err: any) {
    console.warn("IMGBB upload failed, trying STORE fallback:", err);
    try {
      const sbRes = await uploadToSupabaseStore(file);
      return { ...sbRes, modeUsed: 'STORE' };
    } catch (sbErr) {
      console.warn("STORE fallback failed, converting to SBASE64:", sbErr);
      const base64Url = await fileToBase64Compressed(file);
      return {
        url: base64Url,
        displayUrl: base64Url,
        title: file instanceof File ? file.name : 'image',
        modeUsed: 'SBASE64'
      };
    }
  }
}

/**
 * Legacy wrapper function for backward compatibility.
 * Automatically delegates to uploadImageFlexible using current saved preference or passed mode.
 */
export async function uploadToImgBB(
  file: File | Blob, 
  customApiKey?: string
): Promise<ImgBBUploadResult> {
  return uploadImageFlexible(file, undefined, customApiKey);
}

