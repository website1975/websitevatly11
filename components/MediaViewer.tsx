import React, { useState } from 'react';
import { Music, FileText, Cloud, Globe, ExternalLink, BookOpen, AlertCircle, RefreshCw, Monitor, X } from 'lucide-react';

const YoutubeIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export type MediaType = 'youtube' | 'audio' | 'pdf' | 'gdrive' | 'notebooklm' | 'external';

export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();
  
  // Match youtube watch, embed, shorts, live, or youtu.be
  const watchMatch = clean.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (watchMatch && watchMatch[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&rel=0`;
  }
  return null;
}

export function detectMediaType(url: string): MediaType {
  if (!url) return 'external';
  const clean = url.trim().toLowerCase();

  // YouTube
  if (getYouTubeEmbedUrl(url)) {
    return 'youtube';
  }

  // Audio
  if (
    clean.endsWith('.mp3') ||
    clean.endsWith('.wav') ||
    clean.endsWith('.m4a') ||
    clean.endsWith('.ogg') ||
    clean.endsWith('.aac') ||
    clean.endsWith('.flac') ||
    clean.includes('.mp3?') ||
    clean.includes('.wav?') ||
    clean.includes('.m4a?') ||
    clean.includes('audio/')
  ) {
    return 'audio';
  }

  // PDF
  if (
    clean.endsWith('.pdf') ||
    clean.includes('.pdf?') ||
    (clean.includes('drive.google.com') && clean.includes('pdf'))
  ) {
    return 'pdf';
  }

  // NotebookLM
  if (
    clean.includes('notebook.google.com') ||
    clean.includes('notebooklm.google.com') ||
    clean.includes('notebooklm')
  ) {
    return 'notebooklm';
  }

  // Google Drive / Docs
  if (clean.includes('drive.google.com') || clean.includes('docs.google.com')) {
    return 'gdrive';
  }

  return 'external';
}

export function formatIframeUrl(url: string): string {
  if (!url) return '';
  let cleanUrl = url.trim();

  // YouTube
  const ytEmbed = getYouTubeEmbedUrl(cleanUrl);
  if (ytEmbed) return ytEmbed;

  // Google Drive / Docs
  if (cleanUrl.includes('drive.google.com') || cleanUrl.includes('docs.google.com')) {
    if (cleanUrl.includes('/view') || cleanUrl.includes('/edit')) {
      cleanUrl = cleanUrl.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
    } else if (!cleanUrl.includes('/preview') && cleanUrl.includes('/file/d/')) {
      cleanUrl = cleanUrl.replace(/(\/file\/d\/[^\/]+).*/, '$1/preview');
    } else if (cleanUrl.includes('open?id=')) {
      const fileId = cleanUrl.split('id=')[1]?.split('&')[0];
      if (fileId) cleanUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }

  return cleanUrl;
}

interface MediaViewerProps {
  url: string;
  title?: string;
  themeColor?: string;
  className?: string;
  onClose?: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  url,
  title = 'Nội dung học liệu',
  themeColor = 'indigo',
  className = 'w-full h-full',
  onClose
}) => {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'embed' | 'card'>('embed');
  const mediaType = detectMediaType(url);
  const formattedUrl = formatIframeUrl(url);

  // Extract domain for display
  let domain = '';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch (e) {
    domain = url;
  }

  // YOUTUBE VIEWER
  if (mediaType === 'youtube') {
    return (
      <div className={`flex flex-col bg-slate-950 text-white ${className}`}>
        <div className="flex-1 relative w-full h-full flex items-center justify-center bg-black">
          <iframe
            src={formattedUrl}
            title={title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2 font-medium truncate mr-2">
            <YoutubeIcon size={18} className="text-red-500 shrink-0" />
            <span className="truncate text-white font-bold">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-md shrink-0"
            >
              <ExternalLink size={13} /> Xem trên YouTube
            </a>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold text-[11px] flex items-center gap-1 transition-colors"
                title="Đóng cửa sổ"
              >
                <X size={14} /> Đóng
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // AUDIO VIEWER
  if (mediaType === 'audio') {
    return (
      <div className={`flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white ${className} relative`}>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-red-600 text-white rounded-full transition-all shadow-lg z-10"
            title="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        )}
        <div className="w-full max-w-lg bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/15 shadow-2xl flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/30">
            <Music size={40} className="text-white animate-pulse" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-full text-[10px] font-black uppercase tracking-widest">
              Audio / Tệp Âm Thanh
            </span>
            <h3 className="text-lg font-bold text-white max-w-md line-clamp-2 leading-snug">
              {title}
            </h3>
          </div>

          <div className="w-full bg-slate-950/70 p-4 rounded-2xl border border-white/10 shadow-inner">
            <audio controls autoPlay src={url} className="w-full accent-indigo-500 outline-none" />
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95"
          >
            <ExternalLink size={15} /> Mở / Tải tệp âm thanh gốc
          </a>
        </div>
      </div>
    );
  }

  // NOTEBOOKLM VIEWER
  if (mediaType === 'notebooklm') {
    return (
      <div className={`flex flex-col items-center justify-center p-6 bg-slate-50 ${className} relative`}>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 bg-slate-200 hover:bg-red-600 hover:text-white text-slate-600 rounded-full transition-all z-10"
            title="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        )}
        <div className="w-full max-w-lg bg-white p-8 rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center text-center space-y-5">
          <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-3xl flex items-center justify-center shadow-sm">
            <BookOpen size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900">Sổ tay Google NotebookLM</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Liên kết này thuộc dịch vụ Google NotebookLM. Do chính sách bảo mật từ chối nhúng (iframe), trang cần được mở trực tiếp ở thẻ mới.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-purple-200 transition-all flex items-center gap-2"
          >
            <ExternalLink size={16} /> Mở Google NotebookLM trong tab mới
          </a>
        </div>
      </div>
    );
  }

  // GOOGLE DRIVE VIEWER
  if (mediaType === 'gdrive') {
    return (
      <div className={`flex flex-col bg-white ${className}`}>
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <Cloud size={16} className="text-blue-400 shrink-0" />
            <span className="truncate text-white font-bold">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg shrink-0 flex items-center gap-1 shadow-xs transition-all"
            >
              <ExternalLink size={12} /> Mở tab mới
            </a>
            {onClose && (
              <button
                onClick={onClose}
                className="px-2.5 py-1 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border border-slate-700"
                title="Đóng cửa sổ"
              >
                <X size={13} /> Đóng
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 relative w-full h-full overflow-hidden">
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90 backdrop-blur-xs">
              <RefreshCw className="animate-spin text-indigo-500 mb-2" size={28} />
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Đang tải tài liệu...</p>
            </div>
          )}
          <iframe
            src={formattedUrl}
            title={title}
            className="w-full h-full border-0"
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    );
  }

  // PDF VIEWER
  if (mediaType === 'pdf') {
    return (
      <div className={`flex flex-col bg-slate-100 ${className}`}>
        <div className="bg-slate-900 text-slate-200 px-4 py-2 flex items-center justify-between text-xs shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2 font-medium truncate mr-2">
            <FileText size={16} className="text-red-400 shrink-0" />
            <span className="truncate font-bold text-white">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
            >
              <ExternalLink size={12} /> Mở tab mới
            </a>
            {onClose && (
              <button
                onClick={onClose}
                className="px-2.5 py-1 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border border-slate-700"
                title="Đóng cửa sổ"
              >
                <X size={13} /> Đóng
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 relative w-full h-full">
          <iframe
            src={formattedUrl}
            title={title}
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>
    );
  }

  // EXTERNAL LINKS (GENERAL WEBSITE SHARE LINKS)
  return (
    <div className={`flex flex-col bg-slate-50 w-full h-full ${className}`}>
      {/* Banner warning & Open in new tab recommendation */}
      <div className="bg-slate-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 border-b border-slate-800 z-10 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Globe size={15} className="text-sky-400 shrink-0" />
          <div className="min-w-0">
            <span className="font-bold text-white truncate block text-[11px]">{title}</span>
            <span className="text-[9px] text-slate-400 truncate block">Nguồn: {domain}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setViewMode(prev => prev === 'embed' ? 'card' : 'embed')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold border border-slate-700 transition-colors flex items-center gap-1"
            title="Đổi chế độ hiển thị"
          >
            <Monitor size={12} /> {viewMode === 'embed' ? 'Thẻ chuyển hướng' : 'Xem dạng nhúng'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-sky-500 hover:bg-sky-600 text-white font-black text-[10px] uppercase rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <ExternalLink size={12} /> Mở tab mới
          </a>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border border-slate-700"
              title="Đóng cửa sổ"
            >
              <X size={13} /> Đóng
            </button>
          )}
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-100">
          <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center text-center space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center shadow-sm border border-sky-100">
              <Globe size={32} />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-sky-600 tracking-widest bg-sky-50 px-3 py-1 rounded-full border border-sky-100">
                Liên kết web chia sẻ ({domain})
              </span>
              <h3 className="text-base font-black text-slate-900 pt-2 line-clamp-2">{title}</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Trang web chia sẻ từ <b>{domain}</b> có thể không hỗ trợ nhúng trực tiếp trong khung hình do chính sách bảo mật X-Frame-Options. Vui lòng bấm chuyển hướng sang tab mới để xem đầy đủ nội dung.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
              <button
                onClick={() => setViewMode('embed')}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all"
              >
                Thử xem nhúng
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-sky-200 transition-all flex items-center justify-center gap-2"
              >
                <ExternalLink size={15} /> Mở trong tab mới
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative w-full h-full min-h-0 overflow-hidden">
          {/* Subtle note bar inside frame container */}
          <div className="bg-amber-50/90 border-b border-amber-200/80 px-3 py-1 flex items-center justify-between text-[10px] text-amber-900 shrink-0 z-10">
            <span className="flex items-center gap-1.5 truncate">
              <AlertCircle size={13} className="text-amber-600 shrink-0" />
              <span>Nếu trang bị trắng hoặc lỗi kết nối: hãy bấm nút <b>"Mở tab mới"</b> ở góc phải.</span>
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[9px] shrink-0 ml-2"
            >
              Mở tab mới
            </a>
          </div>
          <iframe
            src={formattedUrl}
            title={title}
            className="w-full h-full flex-1 border-0 bg-white min-h-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
};

interface MediaViewerModalProps {
  url: string;
  title: string;
  themeColor?: string;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  url,
  title,
  themeColor = 'indigo',
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
      <div className="flex-1 w-full h-full overflow-hidden bg-white">
        <MediaViewer
          url={url}
          title={title}
          themeColor={themeColor}
          onClose={onClose}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

