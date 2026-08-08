import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
const env = (import.meta as any).env || {};
const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || "zinc-lotus-0bndl",
  appId: env.VITE_FIREBASE_APP_ID || "1:565062106080:web:921a31222f9ed356c08985",
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyBcHdqfomUk8aVxZtJt_ikAzoXxsBeGiWI",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "zinc-lotus-0bndl.firebaseapp.com",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "zinc-lotus-0bndl.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "565062106080",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "",
  oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || "565062106080-5rhr93hbu09crtbq29f13h3m0b5eits4.apps.googleusercontent.com",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem('gdrive_token') : null;
let isSigningIn = false;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleForDrive = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không thể lấy Google Access Token từ Google Sign-In.');
    }
    cachedAccessToken = credential.accessToken;
    try {
      sessionStorage.setItem('gdrive_token', cachedAccessToken);
    } catch (e) {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Drive Error:', error);
    const errorCode = error?.code || '';
    const errorMessage = error?.message || String(error);

    if (errorCode === 'auth/operation-not-allowed') {
      throw new Error(`Google Sign-In chưa được KÍCH HOẠT trong Firebase Auth!\n\nCách khắc phục:\n1. Vào Firebase Console (console.firebase.google.com) -> Chọn dự án của bạn\n2. Vào mục Authentication -> Tab "Sign-in method" (Phương thức đăng nhập)\n3. Tìm "Google" -> Bấm Chỉnh sửa (Edit) -> Bật "Enable" (Bật) -> Chọn Email hỗ trợ (Support email) -> Bấm "Save" (Lưu).`);
    }

    if (errorCode === 'auth/unauthorized-domain') {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'tên miền ứng dụng';
      throw new Error(`Tên miền "${hostname}" chưa được cấp quyền trong Firebase Auth (Authorized Domains)!\n\nCách khắc phục:\n1. Vào Firebase Console -> Authentication -> Tab "Settings" -> Authorized domains\n2. Bấm "Add domain" và thêm: ${hostname}`);
    }

    if (errorCode === 'auth/popup-blocked') {
      throw new Error('Trình duyệt đã chặn cửa sổ Popup đăng nhập Google!\n\nVui lòng kiểm tra góc trên thanh địa chỉ trình duyệt (biểu tượng 🚫), bấm "Cho phép Popup" (Allow Popups) rồi thử lại.');
    }

    if (errorCode === 'auth/popup-closed-by-user') {
      throw new Error('Bạn đã đóng cửa sổ đăng nhập Google trước khi xác nhận.');
    }

    throw new Error(`Lỗi đăng nhập Google (${errorCode || 'chưa xác định'}): ${errorMessage}`);
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export interface DriveUploadResult {
  fileId: string;
  name: string;
  previewUrl: string;
  viewUrl: string;
}

export const uploadFileToGoogleDrive = async (file: File): Promise<DriveUploadResult> => {
  let token = cachedAccessToken;
  if (!token) {
    const authResult = await signInWithGoogleForDrive();
    token = authResult.accessToken;
  }

  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const uploadResp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  if (!uploadResp.ok) {
    const errorBody = await uploadResp.text();
    // If 401 unauthorized, clear token so next time re-authenticates
    if (uploadResp.status === 401) {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem('gdrive_token');
      } catch (e) {}
    }

    if (errorBody.includes('Google Drive API has not been used') || errorBody.includes('accessNotConfigured') || (uploadResp.status === 403 && errorBody.includes('drive.googleapis.com'))) {
      throw new Error(
        `Google Drive API CHƯA ĐƯỢC BẬT trong Dự án Google Cloud của bạn!\n\n` +
        `Cách bật rất đơn giản (chỉ làm 1 lần):\n` +
        `1. Click vào link này (hoặc mở liên kết bên dưới):\n` +
        `https://console.developers.google.com/apis/library/drive.googleapis.com?project=205893893413\n\n` +
        `2. Nhấp nút màu xanh "ENABLE" (BẬT API).\n` +
        `3. Đợi khoảng 30 giây - 1 phút rồi quay lại ứng dụng tải lên lại!`
      );
    }

    throw new Error(`Upload lên Google Drive thất bại (${uploadResp.status}): ${errorBody}`);
  }

  const data = await uploadResp.json();
  const fileId = data.id;

  // Set permission to anyone with link can view ('reader')
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (permErr) {
    console.warn('Lỗi phân quyền công khai Google Drive file:', permErr);
  }

  const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  const viewUrl = data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  return {
    fileId,
    name: data.name || file.name,
    previewUrl,
    viewUrl,
  };
};

export const extractDriveFileId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

export const isGoogleDriveUrl = (url: string): boolean => {
  if (!url) return false;
  return url.toLowerCase().includes('drive.google.com') || url.toLowerCase().includes('docs.google.com');
};
