import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';

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
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Trình duyệt đã chặn cửa sổ Popup đăng nhập Google!\n\nVui lòng kiểm tra góc trên thanh địa chỉ trình duyệt (hoặc biểu tượng 🚫), bấm "Cho phép Popup" (Allow Popups) rồi bấm lại nút "Tải lên Google Drive".');
    }
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Bạn đã đóng cửa sổ đăng nhập Google trước khi xác nhận.');
    }
    throw error;
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
