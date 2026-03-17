'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WatchLinks } from '../types';
import { openSystemBrowser, openDeepLink, isNativePlatform } from '@/lib/capacitor';

interface WatchModalProps {
  watchLinks: WatchLinks | null;
  title?: string;
  year?: number;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

const NetflixIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="#E50914">
    <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c.011.007.022.015.035.024 1.229-.32 2.532-.569 3.855-.756V0h-8.6zm-8.487 0H0v24h5.398V11.478L1.462 0z"/>
  </svg>
);

const PrimeIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M.045 18.02c.07-.116.19-.197.336-.23A21.676 21.676 0 0011.703 24c4.058 0 7.74-1.108 10.352-3.235.174-.141.403-.13.558.023.172.17.147.449-.055.596C19.78 23.5 16.09 24.85 11.703 24.85c-4.56 0-8.632-1.45-11.39-3.95-.132-.12-.16-.32-.067-.458L.045 18.02zM12 5.4a6.6 6.6 0 100 13.2 6.6 6.6 0 000-13.2zm-1.2 9.6V9l5.4 3-5.4 3z"/>
  </svg>
);

const DisneyIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M2.056 6.834c-.072.123-.048.279.06.375l.468.42c.108.096.276.084.372-.024.456-.516 1.26-.984 2.268-.984 1.08 0 1.872.588 1.872 1.464 0 .816-.636 1.32-1.656 1.32h-.672a.27.27 0 00-.264.264v.648c0 .144.12.264.264.264h.672c1.14 0 1.848.564 1.848 1.476 0 .96-.84 1.608-2.088 1.608-1.104 0-1.992-.492-2.508-1.08a.264.264 0 00-.372-.036l-.492.432a.264.264 0 00-.048.372c.672.804 1.86 1.44 3.42 1.44 2.016 0 3.48-1.08 3.48-2.7 0-1.14-.756-1.98-1.872-2.292.924-.348 1.56-1.104 1.56-2.1 0-1.5-1.284-2.52-3.24-2.52-1.404 0-2.52.564-3.072 1.252z"/>
  </svg>
);

const AppleTVIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

const HBOIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M7.042 16.896H4.414v-3.754H2.708v3.754H.01L0 7.22h2.708v3.6h1.706v-3.6h2.628zm12.043.046C21.795 16.94 24 14.689 24 11.978a4.89 4.89 0 00-4.915-4.92c-2.71-.002-4.916 2.248-4.916 4.92 0 2.71 2.208 4.964 4.916 4.964zm-.004-2.467c-1.412 0-2.437-1.084-2.437-2.497 0-1.37.93-2.457 2.437-2.457 1.508 0 2.438 1.085 2.438 2.457 0 1.413-1.025 2.497-2.438 2.497zM8.865 12.37v.002c0-.009 0-.016-.002-.026l.002.024zm4.261-1.41c0-1.723-1.364-3.74-4.038-3.74H5.91v9.676h3.18c2.927 0 4.037-2.214 4.037-3.935v-.002zm-2.572 0c0 .955-.683 1.467-1.465 1.467v-2.935c.782 0 1.465.513 1.465 1.468z"/>
  </svg>
);

const HuluIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M2 2v20h20V2H2zm14.154 14.58c0 .284-.23.514-.515.514H8.362a.515.515 0 01-.515-.515v-5.58c0-.924.75-1.674 1.674-1.674h4.958c.924 0 1.675.75 1.675 1.674v5.58z"/>
  </svg>
);

const ParamountIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M12 2L2 12l10 10 10-10L12 2zm0 3l7 7-7 7-7-7 7-7z"/>
  </svg>
);

const PeacockIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-2-6l5-3-5-3v6z"/>
  </svg>
);

const PLATFORMS: { key: keyof WatchLinks; label: string; color: string; icon: () => JSX.Element }[] = [
  { key: 'netflix', label: 'Netflix', color: '#E50914', icon: NetflixIcon },
  { key: 'apple', label: 'Apple TV+', color: '#000000', icon: AppleTVIcon },
  { key: 'prime', label: 'Prime Video', color: '#00A8E1', icon: PrimeIcon },
  { key: 'disney', label: 'Disney+', color: '#113CCF', icon: DisneyIcon },
  { key: 'hbo', label: 'Max', color: '#5822B4', icon: HBOIcon },
  { key: 'hulu', label: 'Hulu', color: '#1CE783', icon: HuluIcon },
  { key: 'paramount', label: 'Paramount+', color: '#0064FF', icon: ParamountIcon },
  { key: 'peacock', label: 'Peacock', color: '#000000', icon: PeacockIcon },
];

function openLink(url: string) {
  if (isNativePlatform) {
    openDeepLink(url);
  } else {
    window.open(url, '_blank');
  }
}

export default function WatchModal({ watchLinks, onClose, anchorRef }: WatchModalProps) {
  if (!watchLinks) return null;

  const available = PLATFORMS.filter(p => watchLinks[p.key]);
  const count = available.length;

  // On iOS native, auto-open Apple TV if available
  if (isNativePlatform && /iPhone|iPad|iPod/.test(navigator.userAgent) && watchLinks.apple) {
    openSystemBrowser(watchLinks.apple);
    onClose();
    return null;
  }

  // Fan out positions in a semi-circle above the button
  const radius = 70;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;

  const getPosition = (index: number) => {
    const angle = count > 1 ? startAngle + angleStep * index : 1.5 * Math.PI;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  const anchorRect = anchorRef?.current?.getBoundingClientRect();

  return (
    <AnimatePresence>
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
              openLink(watchLinks[platform.key]!);
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
    </AnimatePresence>
  );
}
