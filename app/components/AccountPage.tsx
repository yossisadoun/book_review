'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Trash2, Lightbulb, Headphones, Play, Film, ScrollText, BookMarked } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getGrokUsageLogs } from '../services/api-utils';
import type { GrokUsageLog } from '../types';
import type { RemoteFeatureFlags } from '@/lib/remote-feature-flags';

function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 80%, 50%))`;
}

const standardGlassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg-subtle)',
  borderRadius: '16px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border)',
};

const blueGlassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg-blue)',
  borderRadius: '999px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border-blue)',
};

const glassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  borderRadius: '16px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border)',
};

const ANONYMOUS_BOOK_LIMIT = 20;

interface AccountPageProps {
  user: any;
  isAnonymous: boolean;
  signOut: () => Promise<void>;
  bookCount: number;
  contentPreferences: Record<string, any>;
  onContentPreferencesChange: (prefs: Record<string, any>) => void;
  onConnectAccount: () => void;
  onClose: () => void;
  scrollContainerRef: React.MutableRefObject<HTMLElement | null>;
  onScroll: (scrollTop: number) => void;
  remoteFlags: RemoteFeatureFlags;
}

export default function AccountPage({
  user,
  isAnonymous,
  signOut,
  bookCount,
  contentPreferences,
  onContentPreferencesChange,
  onConnectAccount,
  onClose,
  scrollContainerRef,
  onScroll,
  remoteFlags,
}: AccountPageProps) {
  const [grokUsageLogs, setGrokUsageLogs] = useState<GrokUsageLog[]>([]);
  const [isLoadingGrokLogs, setIsLoadingGrokLogs] = useState(false);
  const [isProfilePublic, setIsProfilePublic] = useState(true);
  const [isLoadingPrivacySetting, setIsLoadingPrivacySetting] = useState(false);
  const [isSavingPrivacySetting, setIsSavingPrivacySetting] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const userEmail = user?.email || '';
  const userName = user?.user_metadata?.full_name || userEmail.split('@')[0];

  // Load Grok usage logs
  useEffect(() => {
    if (!user || isAnonymous) return;
    let cancelled = false;
    (async () => {
      setIsLoadingGrokLogs(true);
      try {
        const logs = await getGrokUsageLogs(user.id);
        if (!cancelled) setGrokUsageLogs(logs);
      } catch (err) {
        console.error('[Account] Error loading Grok usage logs:', err);
        if (!cancelled) setGrokUsageLogs([]);
      } finally {
        if (!cancelled) setIsLoadingGrokLogs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, isAnonymous]);

  // Load privacy setting
  useEffect(() => {
    if (!user || isAnonymous) return;
    let cancelled = false;
    (async () => {
      setIsLoadingPrivacySetting(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('is_public')
          .eq('id', user.id)
          .maybeSingle();

        if (!cancelled) {
          if (!error && data && typeof data.is_public === 'boolean') {
            setIsProfilePublic(data.is_public);
          } else {
            setIsProfilePublic(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Account] Error loading privacy setting:', err);
          setIsProfilePublic(true);
        }
      } finally {
        if (!cancelled) setIsLoadingPrivacySetting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, isAnonymous]);

  const handleTogglePrivacy = async () => {
    if (!user || isSavingPrivacySetting) return;
    const nextValue = !isProfilePublic;
    setIsProfilePublic(nextValue);
    setIsSavingPrivacySetting(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_public: nextValue })
        .eq('id', user.id)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            is_public: nextValue,
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error('[Account] Error saving privacy setting:', upsertError);
          setIsProfilePublic(!nextValue);
        }
      }
    } catch (err) {
      console.error('[Account] Error saving privacy setting:', err);
      setIsProfilePublic(!nextValue);
    } finally {
      setIsSavingPrivacySetting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      // Refresh session to ensure token is valid
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
      const token = refreshedSession?.access_token;
      if (!token) throw new Error('No session');

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('[Account] Delete response:', res.status, body);
        throw new Error(body.detail || body.error || 'Failed to delete account');
      }

      setShowDeleteAccountConfirm(false);
      onClose();
      await signOut();
    } catch (err: any) {
      console.error('[Account] Delete error:', err);
      alert('Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const contentItems = [
    { key: 'fun_facts', icon: Lightbulb, label: 'Fun Facts' },
    { key: 'podcasts', icon: Headphones, label: 'Podcasts' },
    { key: 'youtube', icon: Play, label: 'YouTube Videos' },
    { key: 'related_work', icon: Film, label: 'Related Work' },
    { key: 'articles', icon: ScrollText, label: 'Academic Articles' },
    { key: 'related_books', icon: BookMarked, label: 'Related Books' },
  ];
  const order: string[] = contentPreferences._order || contentItems.map(i => i.key);

  const handleTogglePref = (key: string, enabled: boolean) => {
    const next = { ...contentPreferences, [key]: !enabled };
    onContentPreferencesChange(next);
  };

  return (
    <>
      <motion.main
        key="account"
        ref={(el) => { scrollContainerRef.current = el; if (el) { el.scrollTop = 0; onScroll(0); } }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
        style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      >
        <div className="w-full max-w-[600px] md:max-w-[800px] flex flex-col gap-4 px-4 py-8">
          {/* User Info Card */}
          <div className="rounded-2xl p-6" style={standardGlassmorphicStyle}>
            {isAnonymous ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center border-2 border-white/50">
                    <User size={28} className="text-slate-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Guest Account</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Limited features</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-slate-600 dark:text-slate-400">Books used</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{bookCount} / {ANONYMOUS_BOOK_LIMIT}</p>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (bookCount / ANONYMOUS_BOOK_LIMIT) * 100)}%`,
                        background: bookCount >= ANONYMOUS_BOOK_LIMIT ? '#ef4444' : 'rgba(59, 130, 246, 0.85)',
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={onConnectAccount}
                  className="w-full py-2.5 rounded-lg font-bold text-sm text-white active:scale-95 transition-all"
                  style={{
                    background: 'rgba(59, 130, 246, 0.85)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  Connect account
                </button>

                <div className="flex items-center justify-center pt-4 mt-4 border-t border-slate-200/50">
                  <button
                    onClick={async () => {
                      const confirmed = window.confirm(
                        `You have ${bookCount} book${bookCount !== 1 ? 's' : ''} saved as a guest. Signing out will permanently lose this data. Continue?`
                      );
                      if (!confirmed) return;
                      await handleSignOut();
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 hover:opacity-80 active:scale-95 transition-all"
                    style={glassmorphicStyle}
                  >
                    <LogOut size={16} className="text-slate-600" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-6">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="w-16 h-16 shrink-0 rounded-full object-cover border-2 border-white/50"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 shrink-0 rounded-full flex items-center justify-center border-2 border-white/50" style={{ background: avatarGradient(user?.id || userName) }}>
                      <span className="text-2xl font-bold text-white">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">{userName}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-200/50">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 hover:opacity-80 active:scale-95 transition-all"
                    style={glassmorphicStyle}
                  >
                    <LogOut size={16} className="text-slate-600" />
                    <span>Sign Out</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteAccountConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-red-500 hover:opacity-80 active:scale-95 transition-all"
                    style={glassmorphicStyle}
                  >
                    <Trash2 size={16} />
                    <span>Delete Account</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Privacy */}
          {!isAnonymous && <div className="rounded-2xl p-4" style={standardGlassmorphicStyle}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50">Privacy</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Public lets others view your bookshelf and see your added books in their feed.
                </p>
              </div>
              <button
                onClick={handleTogglePrivacy}
                disabled={isLoadingPrivacySetting || isSavingPrivacySetting}
                className={`min-w-[88px] px-3 py-2 text-xs font-bold rounded-full transition-all ${
                  isProfilePublic
                    ? 'text-white active:scale-95'
                    : 'text-slate-700 dark:text-slate-300 hover:opacity-80 active:scale-95'
                } ${isLoadingPrivacySetting || isSavingPrivacySetting ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={isProfilePublic ? blueGlassmorphicStyle : glassmorphicStyle}
              >
                {isLoadingPrivacySetting ? 'Loading...' : isProfilePublic ? 'Public' : 'Private'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Private hides your bookshelf and removes your added books from other users&apos; feeds.
            </p>
          </div>}

          {/* Content Preferences */}
          <div className="rounded-2xl p-4" style={standardGlassmorphicStyle}>
            <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50 mb-1">Content Preferences</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">Toggle what shows on book pages.</p>
            <div className="flex flex-col gap-2">
              {order.map((key) => {
                const item = contentItems.find(i => i.key === key);
                if (!item) return null;
                const Icon = item.icon;
                const enabled = contentPreferences[key];
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: 'rgba(255, 255, 255, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                    }}
                  >
                    <Icon size={16} className={enabled ? 'text-blue-600' : 'text-slate-400'} />
                    <span className={`text-sm font-medium flex-1 ${enabled ? 'text-blue-700' : 'text-slate-400'}`}>{item.label}</span>
                    <button
                      onClick={() => handleTogglePref(key, enabled)}
                      className="w-12 h-7 rounded-full relative transition-colors duration-200"
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
          </div>

          {/* Grok API Usage Logs */}
          {remoteFlags.show_grok_costs && !isAnonymous && <div className="rounded-2xl p-4" style={standardGlassmorphicStyle}>
            <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50 mb-3">Grok API Usage</h3>
            {isLoadingGrokLogs ? (
              <motion.div
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="w-16 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                  <div className="w-12 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="py-1 border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="w-28 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                      <div className="w-20 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="w-16 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                      <div className="w-12 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : grokUsageLogs.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">No API requests yet</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs mb-3 pb-2 border-b border-slate-200">
                  <span className="text-slate-600 dark:text-slate-400">Total Cost:</span>
                  <span className="font-bold text-slate-950 dark:text-slate-50">
                    ${grokUsageLogs.reduce((sum, log) => sum + log.estimatedCost, 0).toFixed(4)}
                  </span>
                </div>
                <div className="max-h-[300px] overflow-y-auto ios-scroll space-y-1">
                  {grokUsageLogs.map((log, idx) => {
                    const date = new Date(log.timestamp);
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 py-1 border-b border-slate-100 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{
                            log.function
                              .replace('getGrokDidYouKnowWithSearch', 'Did You Know (web)')
                              .replace('getGrokDidYouKnow', 'Did You Know')
                              .replace('getGrokAuthorFacts', 'Author Facts')
                              .replace('getGrokBookInfluences', 'Influences')
                              .replace('getGrokBookDomain', 'Domain')
                              .replace('getGrokBookContext', 'Context')
                              .replace('getGrokPodcastEpisodes', 'Podcasts')
                              .replace('getRelatedBooks', 'Related Books')
                              .replace('getDiscussionQuestions', 'Discussion')
                              .replace('generateTriviaQuestions', 'Trivia')
                          }</span>
                          <span className="text-slate-500 dark:text-slate-400">{dateStr} {timeStr}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-slate-600 dark:text-slate-400">
                            {log.totalTokens.toLocaleString()} tokens
                          </span>
                          <span className="font-medium text-slate-950 dark:text-slate-50">
                            ${log.estimatedCost.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>}

        </div>
      </motion.main>

      {/* Delete Account Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteAccountConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => !isDeletingAccount && setShowDeleteAccountConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)' }}
            >
              <h3 className="text-lg font-bold text-white mb-2">Delete Account?</h3>
              <p className="text-sm text-slate-300 mb-6">
                This will permanently delete your account, all your books, notes, ratings, and chat history. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  disabled={isDeletingAccount}
                  className="flex-1 py-2.5 rounded-full text-sm font-bold text-white active:scale-95 transition-all"
                  style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 py-2.5 rounded-full text-sm font-bold text-white active:scale-95 transition-all"
                  style={{ background: isDeletingAccount ? '#ef444480' : '#ef4444' }}
                >
                  {isDeletingAccount ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
