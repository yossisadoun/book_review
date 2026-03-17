import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      return ({ children, ...props }: any) => {
        const element = String(prop);
        const htmlProps: Record<string, any> = {};
        for (const [key, value] of Object.entries(props)) {
          if (!['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'layout', 'layoutId'].includes(key)) {
            htmlProps[key] = value;
          }
        }
        const { createElement } = require('react');
        return createElement(element, htmlProps, children);
      };
    },
  }),
  AnimatePresence: ({ children }: any) => children,
}));

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { is_public: true }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'user-1' }, error: null })),
          })),
        })),
      })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } } })),
    },
  },
}));

// Mock capacitor
vi.mock('@/lib/capacitor', () => ({
  triggerLightHaptic: vi.fn(),
}));

// Mock api-utils
vi.mock('../app/services/api-utils', () => ({
  getGrokUsageLogs: vi.fn(() => Promise.resolve([])),
}));

import AccountPage from '../app/components/AccountPage';

const defaultProps = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User', avatar_url: null },
  },
  isAnonymous: false,
  signOut: vi.fn(() => Promise.resolve()),
  bookCount: 5,
  contentPreferences: {
    fun_facts: true,
    podcasts: true,
    youtube: true,
    related_work: true,
    articles: false,
    related_books: true,
    _order: ['fun_facts', 'podcasts', 'youtube', 'related_work', 'articles', 'related_books'],
  },
  onContentPreferencesChange: vi.fn(),
  onConnectAccount: vi.fn(),
  onClose: vi.fn(),
  scrollContainerRef: { current: null },
  onScroll: vi.fn(),
};

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders authenticated user info', () => {
    render(<AccountPage {...defaultProps} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders guest account view for anonymous users', () => {
    render(<AccountPage {...defaultProps} isAnonymous={true} />);
    expect(screen.getByText('Guest Account')).toBeInTheDocument();
    expect(screen.getByText('Limited features')).toBeInTheDocument();
    expect(screen.getByText('5 / 20')).toBeInTheDocument();
    expect(screen.getByText('Connect account')).toBeInTheDocument();
  });

  it('calls onConnectAccount when connect button is clicked', () => {
    render(<AccountPage {...defaultProps} isAnonymous={true} />);
    fireEvent.click(screen.getByText('Connect account'));
    expect(defaultProps.onConnectAccount).toHaveBeenCalled();
  });

  it('calls signOut and onClose when Sign Out is clicked (authenticated)', async () => {
    const signOut = vi.fn(() => Promise.resolve());
    const onClose = vi.fn();
    render(<AccountPage {...defaultProps} signOut={signOut} onClose={onClose} />);
    fireEvent.click(screen.getByText('Sign Out'));
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows delete account button for authenticated users', () => {
    render(<AccountPage {...defaultProps} />);
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog when Delete Account is clicked', () => {
    render(<AccountPage {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete Account'));
    expect(screen.getByText('Delete Account?')).toBeInTheDocument();
    expect(screen.getByText(/permanently delete/)).toBeInTheDocument();
  });

  it('dismisses delete dialog when Cancel is clicked', () => {
    render(<AccountPage {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete Account'));
    expect(screen.getByText('Delete Account?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete Account?')).not.toBeInTheDocument();
  });

  it('renders privacy section for authenticated users', () => {
    render(<AccountPage {...defaultProps} />);
    expect(screen.getByText('Privacy')).toBeInTheDocument();
  });

  it('hides privacy section for anonymous users', () => {
    render(<AccountPage {...defaultProps} isAnonymous={true} />);
    expect(screen.queryByText('Privacy')).not.toBeInTheDocument();
  });

  it('renders content preferences with correct toggles', () => {
    render(<AccountPage {...defaultProps} />);
    expect(screen.getByText('Content Preferences')).toBeInTheDocument();
    expect(screen.getByText('Fun Facts')).toBeInTheDocument();
    expect(screen.getByText('Podcasts')).toBeInTheDocument();
    expect(screen.getByText('YouTube Videos')).toBeInTheDocument();
    expect(screen.getByText('Related Work')).toBeInTheDocument();
    expect(screen.getByText('Academic Articles')).toBeInTheDocument();
    expect(screen.getByText('Related Books')).toBeInTheDocument();
  });

  it('hides content preferences for anonymous users', () => {
    render(<AccountPage {...defaultProps} isAnonymous={true} />);
    expect(screen.queryByText('Content Preferences')).not.toBeInTheDocument();
  });

  it('renders Grok API Usage section for authenticated users', () => {
    render(<AccountPage {...defaultProps} />);
    expect(screen.getByText('Grok API Usage')).toBeInTheDocument();
  });

  it('shows avatar initial when no avatar URL', () => {
    render(<AccountPage {...defaultProps} />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('shows avatar image when avatar URL is provided', () => {
    const user = {
      ...defaultProps.user,
      user_metadata: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.jpg' },
    };
    render(<AccountPage {...defaultProps} user={user} />);
    const img = screen.getByAltText('Test User');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('shows book count progress bar for anonymous users', () => {
    render(<AccountPage {...defaultProps} isAnonymous={true} bookCount={15} />);
    expect(screen.getByText('15 / 20')).toBeInTheDocument();
  });

  // --- Regression tests (from bugs found during extraction) ---

  it('does not have scroll-blocking styles on content preference items', () => {
    const { container } = render(<AccountPage {...defaultProps} />);
    // No element should have touchAction: none or cursor: grab (scroll-blocking drag styles)
    const allElements = container.querySelectorAll('*');
    allElements.forEach((el) => {
      const style = (el as HTMLElement).style;
      expect(style.touchAction).not.toBe('none');
    });
    // No cursor-grab class (drag affordance)
    expect(container.querySelector('.cursor-grab')).toBeNull();
  });

  it('content preference toggle calls onContentPreferencesChange with correct shape', () => {
    const onContentPreferencesChange = vi.fn();
    render(<AccountPage {...defaultProps} onContentPreferencesChange={onContentPreferencesChange} />);
    // Find the "Academic Articles" toggle (currently disabled) and click it
    const articlesRow = screen.getByText('Academic Articles').closest('div')!;
    const toggleButton = articlesRow.querySelector('button')!;
    fireEvent.click(toggleButton);
    expect(onContentPreferencesChange).toHaveBeenCalledTimes(1);
    const newPrefs = onContentPreferencesChange.mock.calls[0][0];
    // articles was false, should now be true
    expect(newPrefs.articles).toBe(true);
    // other prefs unchanged
    expect(newPrefs.fun_facts).toBe(true);
    expect(newPrefs.podcasts).toBe(true);
    // _order should be preserved
    expect(newPrefs._order).toEqual(defaultProps.contentPreferences._order);
  });

  it('does not show delete button for anonymous users', () => {
    render(<AccountPage {...defaultProps} isAnonymous={true} />);
    expect(screen.queryByText('Delete Account')).not.toBeInTheDocument();
  });

  it('guest sign out shows confirmation with book count', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AccountPage {...defaultProps} isAnonymous={true} bookCount={3} />);
    fireEvent.click(screen.getByText('Sign Out'));
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('3 book')
    );
    confirmSpy.mockRestore();
  });
});
