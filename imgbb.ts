import { supabase } from './supabaseClient';

// Public default keys with fallback capability
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
}

/**
 * Upload an image file or blob to ImgBB with automatic fallback to Supabase Storage.
 */
export async function uploadToImgBB(
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
            title: data.data.title || 'image'
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

  // Fallback: If ImgBB fails on all keys, upload to Supabase Storage 'resources' bucket
  try {
    const fileExt = file instanceof File ? (file.name.split('.').pop() || 'png') : 'png';
    const fileName = `imgbb_fallback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const { error } = await supabase.storage.from('resources').upload(`images/${fileName}`, file);
    if (!error) {
      const publicUrl = supabase.storage.from('resources').getPublicUrl(`images/${fileName}`).data.publicUrl;
      return {
        url: publicUrl,
        displayUrl: publicUrl,
        title: 'image'
      };
    }
  } catch (sbErr) {
    console.error("Supabase fallback upload failed:", sbErr);
  }

  throw lastError || new Error("Không thể tải ảnh lên ImgBB. Vui lòng kiểm tra lại kết nối mạng.");
}
