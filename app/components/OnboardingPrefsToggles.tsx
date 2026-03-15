'use client';

import React, { useState } from 'react';
import { Lightbulb, Headphones, Play, Film, ScrollText } from 'lucide-react';

const items = [
  { key: 'fun_facts', icon: Lightbulb, label: 'Book Facts', desc: 'Trivia & behind-the-scenes' },
  { key: 'podcasts', icon: Headphones, label: 'Podcast Episodes', desc: 'Interviews & deep dives' },
  { key: 'youtube', icon: Play, label: 'YouTube Videos', desc: 'Essays & visual analysis' },
  { key: 'related_work', icon: Film, label: 'Movies & Music', desc: 'Inspired films & music' },
  { key: 'articles', icon: ScrollText, label: 'Essays & Research', desc: 'Criticism & academic writing' },
];

interface Props {
  initialPrefs: Record<string, any>;
  onNext: (prefs: Record<string, any>) => void;
  triggerLightHaptic: () => void;
}

const OnboardingPrefsToggles = React.memo(function OnboardingPrefsToggles({ initialPrefs, onNext, triggerLightHaptic }: Props) {
  const [prefs, setPrefs] = useState<Record<string, any>>(initialPrefs);

  return (
    <div className="w-full max-w-[min(340px,90vw)]">
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const enabled = prefs[item.key] !== false;
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.4)' }}
            >
              <Icon size={16} className={enabled ? 'text-blue-600' : 'text-slate-400'} />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${enabled ? 'text-blue-700' : 'text-slate-400'}`}>{item.label}</span>
                <p className={`text-[11px] truncate ${enabled ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPrefs(prev => ({ ...prev, [item.key]: !enabled }));
                  triggerLightHaptic();
                }}
                className="w-12 h-7 rounded-full relative transition-colors duration-200 flex-shrink-0"
                style={{ background: enabled ? 'rgba(59, 130, 246, 0.85)' : 'rgba(0,0,0,0.15)' }}
              >
                <div
                  className="w-6 h-6 rounded-full bg-white absolute top-0.5 transition-transform duration-200 shadow-sm"
                  style={{ transform: enabled ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onNext(prefs)}
        className="w-full mt-4 py-2.5 rounded-xl text-[14px] font-semibold text-white active:scale-[0.97] transition-all"
        style={{ background: 'rgba(59, 130, 246, 0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(59, 130, 246, 0.5)' }}
      >
        Next
      </button>
    </div>
  );
});

export default OnboardingPrefsToggles;
