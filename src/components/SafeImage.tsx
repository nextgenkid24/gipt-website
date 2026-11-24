import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { sanitizeUrl } from '../utils/cmsUtils';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  priority?: boolean;
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackTitle,
  priority = false,
}: SafeImageProps) {
  const safeSrc = sanitizeUrl(src);
  const [failed, setFailed] = useState(false);

  if (!safeSrc || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#181F29] via-[#242E3D] to-[#1E2734] text-white/80 p-6 text-center ${className}`}
      >
        <BookOpen className="w-8 h-8 mb-2 text-[#D95316]" aria-hidden="true" />
        <span className="font-serif text-sm font-medium tracking-wide text-white/90 max-w-[22ch]">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
