// Design system exports

export { colors, gradients } from './colors';
export { typography } from './typography';
export { componentStyles } from './components';

// Re-export commonly used values for convenience
import { colors as themeColors, gradients as themeGradients } from './colors';
import { typography as themeTypography } from './typography';
import { componentStyles as themeComponents } from './components';

export const theme = {
  colors: themeColors,
  gradients: themeGradients,
  typography: themeTypography,
  components: themeComponents,
} as const;
