import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock framer-motion to skip animations
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      // Return a component that passes through all props to the native element
      return ({ children, ...props }: any) => {
        const element = String(prop);
        // Filter out framer-motion-specific props
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

// Mock lottie-react
vi.mock('lottie-react', () => ({
  default: () => <div data-testid="lottie" />,
}));

// Mock JSON imports
vi.mock('@/public/heart_anim.json', () => ({ default: {} }));
vi.mock('@/public/heart_inside.json', () => ({ default: {} }));
vi.mock('@/public/vector-anim-export.json', () => ({ default: {} }));

// Mock child components
vi.mock('../app/components/InfoPageTooltips', () => ({
  default: () => <div data-testid="info-tooltips" />,
}));
vi.mock('../app/components/OnboardingPrefsToggles', () => ({
  default: ({ onNext }: { onNext: (prefs: Record<string, any>) => void }) => (
    <button data-testid="prefs-next" onClick={() => onNext({ fun_facts: true })}>
      Next
    </button>
  ),
}));
vi.mock('../app/components/utils', () => ({
  getAssetPath: (path: string) => path,
}));

import OnboardingScreen from '../app/components/OnboardingScreen';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const defaultProps = {
  variant: 'c' as const,
  userId: 'test-user-123',
  contentPreferences: { fun_facts: true, podcasts: true },
  onClose: vi.fn(),
  onOpenAddBook: vi.fn(),
  onSavePreferences: vi.fn(),
  triggerLightHaptic: vi.fn(),
};

describe('OnboardingScreen', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders variant C with welcome page initially', () => {
    render(<OnboardingScreen {...defaultProps} />);
    expect(screen.getByText('WELCOME TO')).toBeInTheDocument();
  });

  it('renders variant A/B single-page layout', () => {
    render(<OnboardingScreen {...defaultProps} variant="a" />);
    expect(screen.getByText('DISCOVER THE WORLD AROUND THE BOOK')).toBeInTheDocument();
  });

  it('sets hasSeenIntro in localStorage on close', () => {
    render(<OnboardingScreen {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // X close button
    expect(localStorageMock.setItem).toHaveBeenCalledWith('hasSeenIntro_test-user-123', 'true');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not set hasSeenIntro when userId is undefined', () => {
    render(<OnboardingScreen {...defaultProps} userId={undefined} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // X close button
    expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
      expect.stringContaining('hasSeenIntro'),
      expect.anything()
    );
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('navigates to last page via pagination dots', () => {
    render(<OnboardingScreen {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Pagination dots are the last 5 buttons
    const paginationDots = buttons.slice(-5);
    fireEvent.click(paginationDots[4]); // Go to page 4 (Start By Adding)
    expect(screen.getByText(/START BY ADDING/)).toBeInTheDocument();
  });

  it('calls onOpenAddBook when clicking add book on last page', () => {
    render(<OnboardingScreen {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const paginationDots = buttons.slice(-5);
    fireEvent.click(paginationDots[4]); // Go to page 4

    // Click "Add first book" button
    const addButton = screen.getByText('Add first book');
    fireEvent.click(addButton);
    expect(defaultProps.onOpenAddBook).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('hasSeenIntro_test-user-123', 'true');
  });
});
