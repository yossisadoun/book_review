import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import OnboardingPrefsToggles from '../app/components/OnboardingPrefsToggles';

const defaultPrefs = {
  fun_facts: true,
  podcasts: true,
  youtube: true,
  related_work: true,
  articles: true,
};

describe('OnboardingPrefsToggles', () => {
  it('renders all 5 content types', () => {
    render(
      <OnboardingPrefsToggles
        initialPrefs={defaultPrefs}
        onNext={vi.fn()}
        triggerLightHaptic={vi.fn()}
      />
    );

    expect(screen.getByText('Book Facts')).toBeInTheDocument();
    expect(screen.getByText('Podcast Episodes')).toBeInTheDocument();
    expect(screen.getByText('YouTube Videos')).toBeInTheDocument();
    expect(screen.getByText('Movies & Music')).toBeInTheDocument();
    expect(screen.getByText('Essays & Research')).toBeInTheDocument();
  });

  it('toggles a preference off and on', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();

    render(
      <OnboardingPrefsToggles
        initialPrefs={defaultPrefs}
        onNext={onNext}
        triggerLightHaptic={vi.fn()}
      />
    );

    // All toggles should start with blue background (enabled)
    const buttons = screen.getAllByRole('button').filter(b => b.className.includes('rounded-full') && !b.textContent?.includes('Next'));

    // Click the first toggle (Book Facts)
    await user.click(buttons[0]);

    // Click Next and verify prefs were updated
    await user.click(screen.getByText('Next'));
    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ fun_facts: false })
    );
  });

  it('calls onNext with all prefs when Next is clicked', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();

    render(
      <OnboardingPrefsToggles
        initialPrefs={defaultPrefs}
        onNext={onNext}
        triggerLightHaptic={vi.fn()}
      />
    );

    await user.click(screen.getByText('Next'));
    expect(onNext).toHaveBeenCalledWith(defaultPrefs);
  });

  it('triggers haptic on toggle', async () => {
    const user = userEvent.setup();
    const haptic = vi.fn();

    render(
      <OnboardingPrefsToggles
        initialPrefs={defaultPrefs}
        onNext={vi.fn()}
        triggerLightHaptic={haptic}
      />
    );

    const buttons = screen.getAllByRole('button').filter(b => b.className.includes('rounded-full') && !b.textContent?.includes('Next'));
    await user.click(buttons[0]);
    expect(haptic).toHaveBeenCalled();
  });

  it('respects initialPrefs with some disabled', () => {
    const onNext = vi.fn();

    render(
      <OnboardingPrefsToggles
        initialPrefs={{ ...defaultPrefs, podcasts: false, youtube: false }}
        onNext={onNext}
        triggerLightHaptic={vi.fn()}
      />
    );

    // Component should render — we just verify it doesn't crash with mixed prefs
    expect(screen.getByText('Podcast Episodes')).toBeInTheDocument();
    expect(screen.getByText('YouTube Videos')).toBeInTheDocument();
  });
});
