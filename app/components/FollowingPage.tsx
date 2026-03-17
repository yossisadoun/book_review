'use client';

import { useState, useEffect, RefObject } from 'react';
import { motion } from 'framer-motion';
import { Users, ChevronRight } from 'lucide-react';
import { SupabaseClient, User } from '@supabase/supabase-js';

function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 60%), hsl(${h2}, 80%, 50%))`;
}

interface FollowedUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  followed_at: string;
}

interface FollowingPageProps {
  user: User;
  supabase: SupabaseClient;
  scrollContainerRef: RefObject<HTMLElement | null>;
  onScroll: (scrollTop: number) => void;
  onUserClick: (userId: string) => void;
  standardGlassmorphicStyle: React.CSSProperties;
}

export default function FollowingPage({
  user,
  supabase,
  scrollContainerRef,
  onScroll,
  onUserClick,
  standardGlassmorphicStyle,
}: FollowingPageProps) {
  const [followingUsers, setFollowingUsers] = useState<FollowedUser[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [followingSortOrder, setFollowingSortOrder] = useState<'recent_desc' | 'recent_asc' | 'name_desc' | 'name_asc'>('recent_desc');

  useEffect(() => {
    if (!user) return;

    const loadFollowingUsers = async () => {
      setIsLoadingFollowing(true);
      try {
        const { data: followsData, error: followsError } = await supabase
          .from('follows')
          .select('following_id, created_at')
          .eq('follower_id', user.id);

        if (followsError) {
          console.error('[Following] Error fetching follows:', followsError);
          setFollowingUsers([]);
          return;
        }

        if (!followsData || followsData.length === 0) {
          setFollowingUsers([]);
          return;
        }

        const followedAtMap = new Map(followsData.map(f => [f.following_id, f.created_at]));
        const followingIds = followsData.map(f => f.following_id);
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, email')
          .in('id', followingIds);

        if (usersError) {
          console.error('[Following] Error fetching user details:', usersError);
          setFollowingUsers([]);
          return;
        }

        const usersWithFollowedAt = (usersData || []).map(u => ({
          ...u,
          followed_at: followedAtMap.get(u.id) || new Date().toISOString(),
        }));

        setFollowingUsers(usersWithFollowedAt);
      } catch (err) {
        console.error('[Following] Error loading following users:', err);
        setFollowingUsers([]);
      } finally {
        setIsLoadingFollowing(false);
      }
    };

    loadFollowingUsers();
  }, [user]);

  return (
    <motion.main
      key="following"
      ref={(el) => { (scrollContainerRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
      style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
      onScroll={(e) => {
        const target = e.currentTarget;
        onScroll(target.scrollTop);
      }}
    >
      <div className="w-full max-w-[600px] md:max-w-[800px] flex flex-col gap-4 px-4 py-8">
        {isLoadingFollowing ? (
          <motion.div
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-full rounded-2xl p-4 flex items-center gap-4"
            style={standardGlassmorphicStyle}
          >
            <div className="w-12 h-12 rounded-full bg-slate-300/50 dark:bg-slate-600/50 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="w-32 h-5 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mb-2" />
              <div className="w-24 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
            </div>
            <div className="w-5 h-5 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
          </motion.div>
        ) : followingUsers.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={standardGlassmorphicStyle}>
            <Users size={48} className="mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600 dark:text-slate-400">You're not following anyone yet.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Find readers in the community and follow them to see their books here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-start mb-2">
              <button
                onClick={() => {
                  const order: Array<'recent_desc' | 'recent_asc' | 'name_desc' | 'name_asc'> = ['recent_desc', 'recent_asc', 'name_asc', 'name_desc'];
                  const currentIndex = order.indexOf(followingSortOrder);
                  const nextIndex = (currentIndex + 1) % order.length;
                  setFollowingSortOrder(order[nextIndex]);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all text-slate-700 dark:text-slate-300 hover:opacity-80 active:scale-95"
                style={standardGlassmorphicStyle}
              >
                <span>
                  {followingSortOrder === 'recent_desc' ? 'Recent ↓' :
                   followingSortOrder === 'recent_asc' ? 'Recent ↑' :
                   followingSortOrder === 'name_asc' ? 'Name A-Z' : 'Name Z-A'}
                </span>
              </button>
            </div>
            {[...followingUsers].sort((a, b) => {
              const nameA = (a.full_name || a.email).toLowerCase();
              const nameB = (b.full_name || b.email).toLowerCase();
              if (followingSortOrder === 'recent_desc') {
                return new Date(b.followed_at).getTime() - new Date(a.followed_at).getTime();
              } else if (followingSortOrder === 'recent_asc') {
                return new Date(a.followed_at).getTime() - new Date(b.followed_at).getTime();
              } else if (followingSortOrder === 'name_asc') {
                return nameA.localeCompare(nameB);
              } else {
                return nameB.localeCompare(nameA);
              }
            }).map((followedUser) => (
              <button
                key={followedUser.id}
                onClick={() => onUserClick(followedUser.id)}
                className="w-full rounded-2xl p-4 flex items-center gap-4 hover:opacity-90 active:scale-[0.98] transition-all text-left"
                style={standardGlassmorphicStyle}
              >
                {followedUser.avatar_url ? (
                  <img
                    src={followedUser.avatar_url}
                    alt={followedUser.full_name || followedUser.email}
                    className="w-12 h-12 shrink-0 rounded-full object-cover border-2 border-white/50"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center border-2 border-white/50" style={{ background: avatarGradient(followedUser.id) }}>
                    <span className="text-lg font-bold text-white">
                      {(followedUser.full_name || followedUser.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-950 dark:text-slate-50 truncate">
                    {followedUser.full_name || followedUser.email.split('@')[0]}
                  </p>
                  {followedUser.full_name && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{followedUser.email}</p>
                  )}
                </div>
                <ChevronRight size={20} className="text-slate-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.main>
  );
}
