import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FollowingPage from '../app/components/FollowingPage';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    main: ({ children, ...props }: any) => <main {...props}>{children}</main>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom } as any;
const mockUser = { id: 'user-123' } as any;
const mockScrollRef = { current: null } as any;

const followedUsers = [
  { following_id: 'u1', created_at: '2026-01-15T00:00:00Z' },
  { following_id: 'u2', created_at: '2026-02-20T00:00:00Z' },
];

const userDetails = [
  { id: 'u1', full_name: 'Alice Smith', avatar_url: null, email: 'alice@test.com' },
  { id: 'u2', full_name: 'Bob Jones', avatar_url: 'https://example.com/bob.jpg', email: 'bob@test.com' },
];

function setupMockChain(followsData: any, usersData: any) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'follows') {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: followsData, error: null }),
        }),
      };
    }
    if (table === 'users') {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: usersData, error: null }),
        }),
      };
    }
  });
}

function renderFollowing(props = {}) {
  return render(
    <FollowingPage
      user={mockUser}
      supabase={mockSupabase}
      scrollContainerRef={mockScrollRef}
      onScroll={vi.fn()}
      onUserClick={vi.fn()}
      standardGlassmorphicStyle={{}}
      {...props}
    />
  );
}

describe('FollowingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no following users', async () => {
    setupMockChain([], []);
    renderFollowing();
    await waitFor(() => {
      expect(screen.getByText(/not following anyone/i)).toBeTruthy();
    });
  });

  it('renders followed users', async () => {
    setupMockChain(followedUsers, userDetails);
    renderFollowing();
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeTruthy();
      expect(screen.getByText('Bob Jones')).toBeTruthy();
    });
  });

  it('shows avatar image when available', async () => {
    setupMockChain(followedUsers, userDetails);
    renderFollowing();
    await waitFor(() => {
      const img = screen.getByAltText('Bob Jones') as HTMLImageElement;
      expect(img.src).toContain('bob.jpg');
    });
  });

  it('shows initial letter when no avatar', async () => {
    setupMockChain(followedUsers, userDetails);
    renderFollowing();
    await waitFor(() => {
      expect(screen.getByText('A')).toBeTruthy(); // Alice's initial
    });
  });

  it('calls onUserClick with user id when user card is clicked', async () => {
    setupMockChain(followedUsers, userDetails);
    const onUserClick = vi.fn();
    renderFollowing({ onUserClick });
    await waitFor(() => screen.getByText('Alice Smith'));
    await userEvent.click(screen.getByText('Alice Smith'));
    expect(onUserClick).toHaveBeenCalledWith('u1');
  });

  it('shows email for users with full_name', async () => {
    setupMockChain(followedUsers, userDetails);
    renderFollowing();
    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeTruthy();
    });
  });

  it('handles API error gracefully', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: { message: 'Network error' } }),
      }),
    }));
    renderFollowing();
    await waitFor(() => {
      expect(screen.getByText(/not following anyone/i)).toBeTruthy();
    });
  });
});
