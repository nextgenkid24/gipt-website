import React, { useEffect } from 'react';
import { Download, ExternalLink, PlayCircle, X } from 'lucide-react';
import type { Resource } from '../types';
import {
  getResourceFileLabel,
  getResourceYouTubeId,
  getYouTubeEmbedUrl,
  hasDownloadableFile,
  sanitizeUrl,
} from '../utils/cmsUtils';

interface VideoModalProps {
  resource: Resource | null;
  onClose: () => void;
}

export function VideoModal({ resource, onClose }: VideoModalProps) {
  useEffect(() => {
    if (!resource) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [resource, onClose]);

  if (!resource) return null;
  const videoId = getResourceYouTubeId(resource);
  if (!videoId) return null;

  const embedUrl = getYouTubeEmbedUrl(videoId);
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const downloadable = hasDownloadableFile(resource);
  const safeFileHref = downloadable ? sanitizeUrl(resource.file_url) : '';
  const isInternalApi = safeFileHref.startsWith('/api/resources/');
  const fileBadge = getResourceFileLabel(resource);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0B141E]/85 backdrop-blur-sm gipt-modal-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#132232] border border-slate-700/90 rounded-lg shadow-2xl overflow-hidden gipt-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-700/80 bg-[#0F1B29]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
              <span className="inline-flex items-center gap-1 font-semibold text-[#F78F1E]">
                <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {resource.category}
              </span>
              {resource.publication_year && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{resource.publication_year}</span>
                </>
              )}
            </div>
            <h3
              id="video-modal-title"
              className="font-serif text-lg sm:text-xl font-bold text-white leading-snug"
            >
              {resource.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session video player"
            className="w-9 h-9 inline-flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Responsive 16:9 YouTube Player */}
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={embedUrl}
            title={resource.title}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        {/* Footer with Summary + Optional Accompanying Resource Download */}
        <div className="px-5 py-4 bg-[#0F1B29] border-t border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed line-clamp-2 max-w-2xl">
            {resource.summary}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white border border-slate-600 hover:border-slate-400 rounded transition-colors whitespace-nowrap"
            >
              Open on YouTube
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            {downloadable && safeFileHref && (
              <a
                href={isInternalApi ? `${safeFileHref}?download=1` : safeFileHref}
                download
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#181F29] bg-white hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Download Resource ({fileBadge})
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
