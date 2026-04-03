/**
 * Global CSS Variables Theme System
 * 
 * Design Direction: Refined, editorial feel for legal writing
 * - Warm, paper-like tones for light mode
 * - Deep charcoal for dark mode (not pure black)
 * - Single accent color (indigo)
 * - Professional, premium aesthetic
 */

import { useTheme } from '../theme/ThemeContext';

export const globalStyles = `
  :root {
    /* Brand Accent */
    --accent-hue: 250;
    --accent-chroma: 0.12;
    
    /* Light Mode - Warm Paper */
    --bg-primary: oklch(98% 0.005 60);
    --bg-secondary: oklch(96% 0.008 60);
    --bg-tertiary: oklch(92% 0.012 60);
    --bg-elevated: oklch(100% 0 0);
    
    --text-primary: oklch(20% 0.015 60);
    --text-secondary: oklch(45% 0.012 60);
    --text-tertiary: oklch(65% 0.008 60);
    
    --border-subtle: oklch(90% 0.006 60);
    --border-default: oklch(80% 0.008 60);
    
    --accent-default: oklch(60% var(--accent-chroma) var(--accent-hue));
    --accent-muted: oklch(75% var(--accent-chroma) var(--accent-hue));
    --accent-subtle: oklch(90% calc(var(--accent-chroma) * 0.5) var(--accent-hue));
    
    --success: oklch(65% 0.15 150);
    --warning: oklch(75% 0.15 75);
    --error: oklch(60% 0.18 25);
    
    --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.05);
    --shadow-md: 0 4px 12px oklch(0% 0 0 / 0.08);
    --shadow-lg: 0 8px 24px oklch(0% 0 0 / 0.12);
    
    /* Typography */
    --font-display: 'Fraunces', Georgia, serif;
    --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
    
    --text-xs: 0.75rem;
    --text-sm: 0.875rem;
    --text-base: 1rem;
    --text-lg: 1.125rem;
    --text-xl: 1.25rem;
    --text-2xl: 1.5rem;
    --text-3xl: 2rem;
    --text-4xl: 2.5rem;
    
    --leading-tight: 1.25;
    --leading-normal: 1.5;
    --leading-relaxed: 1.75;
    
    /* Spacing (4px base) */
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
    --space-12: 3rem;
    --space-16: 4rem;
    
    /* Radius */
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --radius-full: 9999px;
    
    /* Transitions */
    --duration-fast: 150ms;
    --duration-normal: 250ms;
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dark {
    /* Dark Mode - Deep Charcoal */
    --bg-primary: oklch(10% 0.008 280);
    --bg-secondary: oklch(14% 0.01 280);
    --bg-tertiary: oklch(20% 0.012 280);
    --bg-elevated: oklch(8% 0.006 280);
    
    --text-primary: oklch(92% 0.005 60);
    --text-secondary: oklch(70% 0.008 60);
    --text-tertiary: oklch(55% 0.006 60);
    
    --border-subtle: oklch(30% 0.008 280);
    --border-default: oklch(40% 0.01 280);
    
    --accent-default: oklch(70% var(--accent-chroma) var(--accent-hue));
    --accent-muted: oklch(55% var(--accent-chroma) var(--accent-hue));
    --accent-subtle: oklch(40% calc(var(--accent-chroma) * 0.5) var(--accent-hue));
    
    --success: oklch(75% 0.15 150);
    --warning: oklch(80% 0.15 75);
    --error: oklch(70% 0.18 25);
    
    --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.3);
    --shadow-md: 0 4px 12px oklch(0% 0 0 / 0.4);
    --shadow-lg: 0 8px 24px oklch(0% 0 0 / 0.5);
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    font-family: var(--font-body);
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    color: var(--text-primary);
    background-color: var(--bg-primary);
    transition: background-color var(--duration-normal) var(--ease-out),
                color var(--duration-normal) var(--ease-out);
  }

  /* Focus styles */
  :focus-visible {
    outline: 2px solid var(--accent-default);
    outline-offset: 2px;
  }

  /* Selection */
  ::selection {
    background-color: var(--accent-subtle);
    color: var(--text-primary);
  }

  /* Scrollbar */
  ::-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--border-default);
    border-radius: var(--radius-full);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-tertiary);
  }

  /* Links */
  a {
    color: var(--accent-default);
    text-decoration: none;
    transition: color var(--duration-fast) var(--ease-out);
  }

  a:hover {
    color: var(--accent-muted);
  }

  /* Buttons base */
  button {
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    border: none;
    background: none;
  }

  /* Inputs base */
  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
    color: var(--text-primary);
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    transition: border-color var(--duration-fast) var(--ease-out),
                box-shadow var(--duration-fast) var(--ease-out);
  }

  input:focus, textarea:focus, select:focus {
    border-color: var(--accent-default);
    box-shadow: 0 0 0 3px var(--accent-subtle);
    outline: none;
  }

  input::placeholder, textarea::placeholder {
    color: var(--text-tertiary);
  }
`;

/**
 * Helper function to create responsive styles object for React
 */
export function getThemeStyles(isDark: boolean) {
  return {
    // Backgrounds
    bgPrimary: isDark ? 'oklch(10% 0.008 280)' : 'oklch(98% 0.005 60)',
    bgSecondary: isDark ? 'oklch(14% 0.01 280)' : 'oklch(96% 0.008 60)',
    bgTertiary: isDark ? 'oklch(20% 0.012 280)' : 'oklch(92% 0.012 60)',
    bgElevated: isDark ? 'oklch(8% 0.006 280)' : 'oklch(100% 0 0)',
    
    // Text
    textPrimary: isDark ? 'oklch(92% 0.005 60)' : 'oklch(20% 0.015 60)',
    textSecondary: isDark ? 'oklch(70% 0.008 60)' : 'oklch(45% 0.012 60)',
    textTertiary: isDark ? 'oklch(55% 0.006 60)' : 'oklch(65% 0.008 60)',
    
    // Borders
    borderSubtle: isDark ? 'oklch(30% 0.008 280)' : 'oklch(90% 0.006 60)',
    borderDefault: isDark ? 'oklch(40% 0.01 280)' : 'oklch(80% 0.008 60)',
    
    // Accent
    accent: isDark ? 'oklch(70% 0.12 250)' : 'oklch(60% 0.12 250)',
    accentMuted: isDark ? 'oklch(55% 0.12 250)' : 'oklch(75% 0.12 250)',
    accentSubtle: isDark ? 'oklch(40% 0.06 250)' : 'oklch(90% 0.06 250)',
    
    // Status
    success: isDark ? 'oklch(75% 0.15 150)' : 'oklch(65% 0.15 150)',
    warning: isDark ? 'oklch(80% 0.15 75)' : 'oklch(75% 0.15 75)',
    error: isDark ? 'oklch(70% 0.18 25)' : 'oklch(60% 0.18 25)',
  };
}
