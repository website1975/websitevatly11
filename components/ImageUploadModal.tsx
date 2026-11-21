import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  UploadCloud, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Check, 
  AlertCircle, 
  Loader2, 
  Clipboard, 
  Key, 
  Settings,
  Sparkles,
  ExternalLink,
  HardDrive,
  Database,
  Zap,
  Cloud,
  FileText,
  FolderOpen
} from 'lucide-react';
import { 
  uploadImageFlexible, 
  getImageServerMode, 
  setImageServerMode, 
  ImageServerMode 
} from '../imgbb';
import { getDriveAccessToken, signInWithGoogleForDrive } from '../googleDrive';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (markdownSnippet: string) => void;
  isAdmin?: boolean;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  isAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [serverMode, setServerMode] = useState<ImageServerMode>(() => getImageServerMode());
  const [usedServerMode, setUsedServerMode] = useState<ImageServerMode | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedIsDoc, setUploadedIsDoc] = useState(false);
  const [altText, setAltText] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(() => Boolean(getDriveAccessToken()));
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  
  // Custom API key settings
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('imgbb_api_key') || '');
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setPreviewUrl(null);
      setUploading(false);
      setUploadProgress('');
      setErrorMessage(null);
      setUploadedUrl(null);
      setUploadedIsDoc(false);
      setAltText('');
      setCustomUrl('');
      setSavedKeySuccess(false);
      setServerMode(getImageServerMode());
      setUsedServerMode(null);
      setIsDriveConnected(Boolean(getDriveAccessToken()));
    }
  }, [isOpen]);

  const handleServerModeChange = (newMode: ImageServerMode) => {
    setServerMode(newMode);
    setImageServerMode(newMode);
    setErrorMessage(null);
  };

  const handleConnectGoogleDrive = async () => {
    setIsConnectingDrive(true);
    setErrorMessage(null);
    try {
      await signInWithGoogleForDrive();
      setIsDriveConnected(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể kết nối Google Drive.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  // Global paste handler when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            processAndUploadFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, customApiKey, serverMode]);

  if (!isOpen) return null;

  const processAndUploadFile = async (selectedFile: File | Blob) => {
    setErrorMessage(null);
    setFile(selectedFile instanceof File ? selectedFile : new File([selectedFile], 'pasted_image.png', { type: selectedFile.type }));
    
    // Create preview
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    setUploading(true);

    const modeLabels: Record<ImageServerMode, string> = {
      STORE: 'máy chủ Supabase Storage',
      SBASE64: 'mã hóa Base64 nội bộ',
      IMGBB: 'máy chủ ImgBB',
      GDRIVE: 'Google Drive'
    };
    setUploadProgress(`Đang tải lên ${modeLabels[serverMode]}...`);

    try {
      const result = await uploadImageFlexible(selectedFile, serverMode, customApiKey);
      setUploadedUrl(result.url);
      setUploadedIsDoc(Boolean(result.isDocument));
      setUsedServerMode(result.modeUsed);
      if (result.modeUsed === 'GDRIVE') {
        setIsDriveConnected(true);
      }
      setUploading(false);
      setUploadProgress('Xử lý tệp thành công!');
      
      const defaultAlt = (selectedFile instanceof File ? selectedFile.name.replace(/\.[^/.]+$/, "") : "Hình ảnh bài tập");
      setAltText(defaultAlt);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploading(false);
      setErrorMessage(err.message || 'Lỗi khi tải tệp. Vui lòng thử chọn phương thức khác.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      processAndUploadFile(f);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const allowsDocuments = serverMode === 'GDRIVE' || serverMode === 'STORE';
    if (f.type.startsWith('image/') || allowsDocuments) {
      processAndUploadFile(f);
    } else {
      setErrorMessage('Vui lòng chọn tệp hình ảnh, hoặc chuyển sang máy chủ GOOGLE để tải tài liệu (PDF, Word, Excel...).');
    }
  };

  const handleSaveApiKey = () => {
    if (customApiKey.trim()) {
      localStorage.setItem('imgbb_api_key', customApiKey.trim());
    } else {
      localStorage.removeItem('imgbb_api_key');
    }
    setSavedKeySuccess(true);
    setTimeout(() => {
      setSavedKeySuccess(false);
      setShowKeyConfig(false);
    }, 1500);
  };

  const handleConfirmInsert = () => {
    let finalImageUrl = '';
    const finalAlt = altText.trim() || (uploadedIsDoc ? 'Tài liệu đính kèm' : 'Hình ảnh');

    if (activeTab === 'upload') {
      if (!uploadedUrl) return;
      finalImageUrl = uploadedUrl;
      if (uploadedIsDoc) {
        const snippet = finalImageUrl.includes('drive.google.com')
          ? `\n\n<iframe src="${finalImageUrl}" width="100%" height="500px" style="border:none; border-radius:12px;" allow="autoplay"></iframe>\n\n[📄 ${finalAlt}](${finalImageUrl})\n\n`
          : `\n\n[📄 ${finalAlt}](${finalImageUrl})\n\n`;
        onInsert(snippet);
        onClose();
        return;
      }
    } else {
      let rawUrl = customUrl.trim();
      if (!rawUrl) return;

      // Convert Google drive links if pasted
      const driveMatch = rawUrl.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^)]*id=)([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        rawUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
      }
      finalImageUrl = rawUrl;
    }

    const snippet = `\n\n![${finalAlt}](${finalImageUrl})\n\n`;
    onInsert(snippet);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight">Chèn ảnh / tài liệu vào bài viết</h3>
              <p className="text-xs font-semibold text-slate-400">Hỗ trợ Google Drive, ImgBB, Supabase Storage & Base64</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 pt-3 bg-white gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'upload' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <UploadCloud size={16} /> Tải ảnh / Dán ảnh (Ctrl + V)
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'url' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <LinkIcon size={16} /> Nhập liên kết (URL)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'upload' ? (
            <div className="space-y-4">
              {/* Server Selection Mode Selector */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <HardDrive size={14} className="text-indigo-600" /> Chọn máy chủ / Nơi lưu trữ:
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {serverMode === 'STORE'
                      ? '1. STORE'
                      : serverMode === 'SBASE64'
                      ? '2. SBASE64'
                      : serverMode === 'IMGBB'
                      ? '3. IMGBB'
                      : '4. GOOGLE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleServerModeChange('STORE')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border text-center ${
                      serverMode === 'STORE'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 ring-2 ring-indigo-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    <Database size={16} />
                    <span className="text-[11px] font-black">STORE</span>
                    <span className="text-[9px] opacity-85 font-semibold">Supabase Storage</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServerModeChange('SBASE64')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border text-center ${
                      serverMode === 'SBASE64'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200 ring-2 ring-emerald-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <Zap size={16} />
                    <span className="text-[11px] font-black">SBASE64</span>
                    <span className="text-[9px] opacity-85 font-semibold">An toàn, không bị xóa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServerModeChange('IMGBB')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border text-center ${
                      serverMode === 'IMGBB'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 ring-2 ring-blue-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <Cloud size={16} />
                    <span className="text-[11px] font-black">IMGBB</span>
                    <span className="text-[9px] opacity-85 font-semibold">API ImgBB</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServerModeChange('GDRIVE')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border text-center ${
                      serverMode === 'GDRIVE'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-200 ring-2 ring-amber-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                    }`}
                  >
                    <FolderOpen size={16} />
                    <span className="text-[11px] font-black">GOOGLE</span>
                    <span className="text-[9px] opacity-85 font-semibold">Google Drive</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 font-medium px-1 leading-relaxed">
                  {serverMode === 'STORE' && '📌 STORE: Tải lên bộ nhớ Supabase Storage (sẽ tính vào dung lượng & băng thông Supabase).'}
                  {serverMode === 'SBASE64' && '⚡ SBASE64: Mã hóa dữ liệu ảnh nhúng trực tiếp. Không phụ thuộc máy chủ bên ngoài.'}
                  {serverMode === 'IMGBB' && '🌐 IMGBB: Tải ảnh lên ImgBB qua API công cộng, không tốn băng thông Supabase.'}
                  {serverMode === 'GDRIVE' && '☁️ GOOGLE DRIVE: Lưu ảnh & tài liệu (PDF, Word, Excel...) trực tiếp lên Google Drive của bạn, không tốn dung lượng Supabase.'}
                </p>

                {serverMode === 'GDRIVE' && (
                  <div className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isDriveConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      {isDriveConnected ? 'Đã kết nối Google Drive' : 'Chưa đăng nhập Google Drive'}
                    </span>
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      disabled={isConnectingDrive}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      {isConnectingDrive ? 'Đang kết nối...' : isDriveConnected ? 'Đổi tài khoản' : 'Đăng nhập Google'}
                    </button>
                  </div>
                )}
              </div>

              {/* Dropzone & Paste area */}
              {!uploadedUrl && !uploading && (
                <div
                  ref={dropzoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    isDragging 
                      ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]' 
                      : 'border-slate-200 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-300'
                  }`}
                >
                  <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-full shadow-sm">
                    <UploadCloud size={28} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-700">
                      Kéo thả {serverMode === 'GDRIVE' || serverMode === 'STORE' ? 'ảnh / tài liệu' : 'ảnh'} vào đây, hoặc <span className="text-indigo-600 underline">bấm để chọn tệp</span>
                    </p>
                    <p className="text-xs font-medium text-slate-400 mt-1">
                      Hỗ trợ dán ảnh nhanh bằng phím tắt <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-mono text-[10px] font-bold">Ctrl + V</span>
                      {serverMode === 'GDRIVE' ? ' • PDF, Word, Excel, Ảnh' : ''}
                    </p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept={serverMode === 'GDRIVE' || serverMode === 'STORE' ? 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' : 'image/*'} 
                    className="hidden" 
                  />
                </div>
              )}

              {/* Uploading State */}
              {uploading && (
                <div className="p-8 border border-indigo-100 rounded-2xl bg-indigo-50/30 flex flex-col items-center justify-center gap-3 text-center animate-in fade-in">
                  <div className="relative">
                    {previewUrl && file?.type?.startsWith('image/') ? (
                      <img 
                        src={previewUrl} 
                        alt="Uploading preview" 
                        className="w-24 h-24 object-cover rounded-xl border-2 border-indigo-300 opacity-60" 
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-xl border-2 border-indigo-200 bg-white flex items-center justify-center">
                        <FileText size={32} className="text-indigo-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/30 rounded-xl">
                      <Loader2 size={30} className="animate-spin text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-black text-indigo-700">{uploadProgress}</p>
                    <p className="text-xs text-indigo-500 font-medium mt-0.5">Phương thức đã chọn: <span className="font-bold uppercase">{serverMode === 'GDRIVE' ? 'GOOGLE DRIVE' : serverMode}</span></p>
                  </div>
                </div>
              )}

              {/* Uploaded Success */}
              {uploadedUrl && (
                <div className="p-4 border border-emerald-100 rounded-2xl bg-emerald-50/30 space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    {uploadedIsDoc ? (
                      <div className="w-20 h-20 rounded-xl border border-emerald-200 bg-white flex flex-col items-center justify-center text-emerald-600 shadow-sm shrink-0">
                        <FileText size={28} />
                        <span className="text-[9px] font-black uppercase mt-1">Tài liệu</span>
                      </div>
                    ) : (
                      <img 
                        src={uploadedUrl} 
                        alt="Uploaded" 
                        className="w-20 h-20 object-cover rounded-xl border border-emerald-200 shadow-sm shrink-0" 
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-black">
                        <Check size={14} className="shrink-0" /> Tải lên [{(usedServerMode || serverMode) === 'GDRIVE' ? 'GOOGLE DRIVE' : (usedServerMode || serverMode)}] thành công!
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono truncate mt-1 bg-white px-2 py-1 rounded border border-emerald-100 max-w-full">
                        {uploadedUrl.length > 80 ? `${uploadedUrl.substring(0, 80)}...` : uploadedUrl}
                      </p>
                      <button 
                        onClick={() => { setUploadedUrl(null); setUploadedIsDoc(false); setFile(null); setPreviewUrl(null); }}
                        className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors mt-1.5 inline-block"
                      >
                        Chọn/dán tệp khác
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 tracking-wider">
                      {uploadedIsDoc ? 'Tiêu đề tài liệu:' : 'Mô tả / Chú thích ảnh:'}
                    </label>
                    <input 
                      type="text"
                      value={altText}
                      onChange={e => setAltText(e.target.value)}
                      placeholder={uploadedIsDoc ? "Nhập tên tài liệu hiển thị..." : "Nhập chú thích ảnh (ví dụ: Sơ đồ mạch điện, Bài giải câu 1...)"}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              )}

              {/* Error state */}
              {errorMessage && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-600 animate-in shake">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Lỗi tải ảnh</p>
                    <p className="text-[11px] text-red-500 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* URL Tab */
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 tracking-wider">
                  Đường dẫn hình ảnh (URL):
                </label>
                <input 
                  type="url"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  placeholder="https://i.ibb.co/... hoặc link Google Drive, Canva, Web"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * Tự động nhận diện và chuyển đổi link Google Drive sang link ảnh hiển thị trực tiếp.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 tracking-wider">
                  Chú thích ảnh:
                </label>
                <input 
                  type="text"
                  value={altText}
                  onChange={e => setAltText(e.target.value)}
                  placeholder="Chú thích ảnh..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {customUrl && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xem trước:</p>
                  <img 
                    src={customUrl.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^)]*id=)([a-zA-Z0-9_-]+)/)?.[1] 
                      ? `https://lh3.googleusercontent.com/d/${customUrl.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^)]*id=)([a-zA-Z0-9_-]+)/)![1]}`
                      : customUrl
                    } 
                    alt="Preview" 
                    className="max-h-36 mx-auto rounded-lg object-contain shadow-sm border border-slate-200"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Teacher/Admin ImgBB Key configuration toggle */}
          {isAdmin && (
            <div className="pt-2 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setShowKeyConfig(!showKeyConfig)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <Key size={13} /> {showKeyConfig ? 'Ẩn cấu hình API Key ImgBB' : 'Cấu hình ImgBB API Key riêng (Giáo viên)'}
              </button>

              {showKeyConfig && (
                <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700">ImgBB API Key riêng:</span>
                    <a 
                      href="https://api.imgbb.com/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      Lấy Key miễn phí <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="password"
                      value={customApiKey}
                      onChange={e => setCustomApiKey(e.target.value)}
                      placeholder="Dán API Key ImgBB của bạn tại đây..."
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                    />
                    <button 
                      type="button"
                      onClick={handleSaveApiKey}
                      className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                    >
                      {savedKeySuccess ? 'Đã lưu!' : 'Lưu Key'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    * Mặc định hệ thống đã có sẵn cụm API Key ImgBB dùng chung không giới hạn cho học sinh.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Sparkles size={13} className="text-amber-500" /> Tự động chèn Markdown vào vùng soạn thảo
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-black text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all uppercase tracking-wider"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirmInsert}
              disabled={uploading || (activeTab === 'upload' && !uploadedUrl) || (activeTab === 'url' && !customUrl.trim())}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              <Check size={14} /> Chèn vào bài
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
