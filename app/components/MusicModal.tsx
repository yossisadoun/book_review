'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { MusicLinks } from '../types';
import { openSystemBrowser, openDeepLink, isNativePlatform } from '@/lib/capacitor';

interface MusicModalProps {
  musicLinks: MusicLinks | null;
  albumTitle?: string;
  albumArtist?: string;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const AppleMusicIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.197 10.473 10.473 0 0018.104.05h-12.2C5.24.05 4.573.1 3.916.237 2.6.555 1.6 1.3.876 2.418A5.023 5.023 0 00.197 4.3 10.474 10.474 0 00.05 5.896v12.208c0 .564.05 1.13.137 1.684.317 1.31 1.062 2.31 2.18 3.043A5.022 5.022 0 004.3 23.803c.596.1 1.198.15 1.8.15h12.104c.664 0 1.33-.05 1.988-.187 1.314-.317 2.314-1.062 3.042-2.18A5.023 5.023 0 0023.803 19.7c.1-.596.15-1.198.15-1.8V6.124h.04zM17.4 10.862v5.447c0 .544-.1 1.072-.354 1.564a2.77 2.77 0 01-1.506 1.32c-.456.174-.938.264-1.422.264-.484 0-.976-.1-1.412-.314a2.24 2.24 0 01-1.176-1.364 2.137 2.137 0 01.152-1.698c.296-.524.756-.908 1.326-1.108.346-.12.706-.2 1.062-.26l.982-.18c.296-.054.42-.174.48-.464v-.024c.004-.05.006-.544.006-.544V8.858c0-.36-.06-.434-.418-.354 0 0-4.494.942-4.904 1.032-.34.074-.414.2-.414.534v6.692c0 .544-.1 1.072-.354 1.564a2.77 2.77 0 01-1.506 1.32c-.456.174-.938.264-1.422.264-.484 0-.976-.1-1.412-.314A2.24 2.24 0 013.9 18.232a2.137 2.137 0 01.152-1.698c.296-.524.756-.908 1.326-1.108.346-.12.706-.2 1.062-.26l.982-.18c.296-.054.42-.174.48-.464.006-.024.006-.544.006-.544V7.37c0-.484.14-.768.604-.878l6.17-1.3c.54-.114.72.06.72.534v5.136z"/>
  </svg>
);

const YouTubeMusicIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
  </svg>
);

const AmazonMusicIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M.045 18.02c.07-.116.19-.197.336-.23A21.676 21.676 0 0011.703 24c4.058 0 7.74-1.108 10.352-3.235.174-.141.403-.13.558.023.172.17.147.449-.055.596C19.78 23.5 16.09 24.85 11.703 24.85c-4.56 0-8.632-1.45-11.39-3.95-.132-.12-.16-.32-.067-.458L.045 18.02zM21.558 16.1c-.232-.303-1.527-.143-2.11-.072-.175.02-.202-.135-.044-.248 1.033-.727 2.728-.517 2.926-.274.198.246-.055 1.946-.862 2.758-.123.125-.24.058-.186-.107.18-.465.736-1.752.505-2.057h-.229zM12 5.4a6.6 6.6 0 100 13.2 6.6 6.6 0 000-13.2zm-1.2 9.6V9l5.4 3-5.4 3z"/>
  </svg>
);

const TidalIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L8.008 8l4.004 4 4.004-4-4.004-4.008zM12.012 12l-4.004 4.004L4.004 12 0 16.004l4.004 4.004L8.008 16l4.004 4.008L16.016 16l-4.004-4zM20.02 3.992l-4.004 4.004L20.02 12l4.004-4.004-4.004-4.004z"/>
  </svg>
);

const DeezerIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38H6.27zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027H6.27zm6.27 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.189v-3.03H6.27zm6.27 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z"/>
  </svg>
);

const PLATFORMS: { key: keyof MusicLinks; label: string; color: string; icon: () => JSX.Element }[] = [
  { key: 'spotify', label: 'Spotify', color: '#1DB954', icon: SpotifyIcon },
  { key: 'appleMusic', label: 'Apple Music', color: '#FC3C44', icon: AppleMusicIcon },
  { key: 'youtubeMusic', label: 'YouTube Music', color: '#FF0000', icon: YouTubeMusicIcon },
  { key: 'amazonMusic', label: 'Amazon Music', color: '#25D1DA', icon: AmazonMusicIcon },
  { key: 'tidal', label: 'Tidal', color: '#000000', icon: TidalIcon },
  { key: 'deezer', label: 'Deezer', color: '#A238FF', icon: DeezerIcon },
];

function openLink(url: string) {
  // On native, use deep link to open music apps directly (e.g. Apple Music, Spotify)
  if (isNativePlatform) {
    openDeepLink(url);
  } else {
    window.open(url, '_blank');
  }
}

export default function MusicModal({ musicLinks, onClose, anchorRef }: MusicModalProps) {
  if (!musicLinks) return null;

  const available = PLATFORMS.filter(p => musicLinks[p.key]);
  const count = available.length;

  // Fan out positions in a semi-circle above the button
  const radius = 70;
  const startAngle = Math.PI; // left
  const endAngle = 2 * Math.PI; // right (arc goes above)
  const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;

  const getPosition = (index: number) => {
    const angle = count > 1 ? startAngle + angleStep * index : 1.5 * Math.PI; // center if single
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  // Get anchor position for the fixed overlay backdrop tap target
  const anchorRect = anchorRef?.current?.getBoundingClientRect();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {/* Invisible full-screen tap target to dismiss */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
      />
      {/* Icons positioned relative to anchor */}
      {anchorRect && available.map((platform, i) => {
        const PlatformIcon = platform.icon;
        const pos = getPosition(i);
        const centerX = anchorRect.left + anchorRect.width / 2;
        const centerY = anchorRect.top + anchorRect.height / 2;

        return (
          <motion.button
            key={platform.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, delay: i * 0.02 }}
            onClick={(e) => {
              e.stopPropagation();
              openLink(musicLinks[platform.key]!);
              onClose();
            }}
            className="fixed z-[9999] w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{
              left: centerX + pos.x - 22,
              top: centerY + pos.y - 22,
              background: platform.color,
              boxShadow: '0 3px 12px rgba(0,0,0,0.3)',
            }}
            title={platform.label}
          >
            <PlatformIcon />
          </motion.button>
        );
      })}
    </AnimatePresence>,
    document.body
  );
}
