export type ReadingFontFamily = 'default' | 'atkinson' | 'georgia' | 'literata' | 'mono';
export type ReadingLineHeight = 'compact' | 'normal' | 'relaxed' | 'loose';
export type ReadingLetterSpacing = 'normal' | 'wide';
export type ReadingTextAlign = 'left' | 'justify';
export type ReadingMeasure = 'narrow' | 'normal' | 'wide';
export type ReadingTheme = 'system' | 'light' | 'dark' | 'sepia' | 'high-contrast';
export type ReadingSpeed = 'snail' | 'slower' | 'slow' | 'normal' | 'fast' | 'faster' | 'turbo' | 'crazy-style';

export const BASE_WPM = 220;

export interface ReadingPreferences {
  fontScale: number;
  fontFamily: ReadingFontFamily;
  lineHeight: ReadingLineHeight;
  letterSpacing: ReadingLetterSpacing;
  textAlign: ReadingTextAlign;
  measure: ReadingMeasure;
  speed: ReadingSpeed;
  theme: ReadingTheme;
}

const DEFAULT_PREFERENCES: ReadingPreferences = {
  fontScale: 1,
  fontFamily: 'default',
  lineHeight: 'normal',
  letterSpacing: 'normal',
  textAlign: 'left',
  measure: 'normal',
  speed: 'fast',
  theme: 'system',
};

const FONT_SCALE_MIN = 0.875;
const FONT_SCALE_MAX = 2;
const FONT_SCALE_STEP = 0.125;

export const FONT_FAMILY_OPTIONS: { label: string; value: ReadingFontFamily; class: string }[] = [
  { label: 'Default', value: 'default', class: '' },
  { label: 'Sans, accessible', value: 'atkinson', class: 'font-accessible' },
  { label: 'Serif', value: 'georgia', class: 'font-serif' },
  { label: 'Serif, reading', value: 'literata', class: 'font-literata' },
  { label: 'Monospace', value: 'mono', class: 'font-mono' },
];

export const LINE_HEIGHT_OPTIONS: { label: string; value: ReadingLineHeight; lineHeight: string }[] = [
  { label: 'Compact', value: 'compact', lineHeight: '1.4' },
  { label: 'Normal', value: 'normal', lineHeight: '1.75' },
  { label: 'Relaxed', value: 'relaxed', lineHeight: '2' },
  { label: 'Loose', value: 'loose', lineHeight: '2.4' },
];

export const MEASURE_OPTIONS: { label: string; value: ReadingMeasure; maxWidth: string }[] = [
  { label: 'Narrow', value: 'narrow', maxWidth: '60ch' },
  { label: 'Normal', value: 'normal', maxWidth: 'none' },
  { label: 'Wide', value: 'wide', maxWidth: '85ch' },
];

export const THEME_OPTIONS: { label: string; value: ReadingTheme; swatchBg: string; swatchText: string }[] = [
  { label: 'System', value: 'system', swatchBg: '#9ca3af', swatchText: '#ffffff' },
  { label: 'Light', value: 'light', swatchBg: '#ffffff', swatchText: '#18181b' },
  { label: 'Dark', value: 'dark', swatchBg: '#18181B', swatchText: '#ffffff' },
  { label: 'Sepia', value: 'sepia', swatchBg: '#f4ecd8', swatchText: '#5b4636' },
  { label: 'High contrast', value: 'high-contrast', swatchBg: '#000000', swatchText: '#ffffff' },
];

export const TEXT_ALIGN_OPTIONS: { label: string; value: ReadingTextAlign; textAlign: string }[] = [
  { label: 'Left', value: 'left', textAlign: 'left' },
  { label: 'Justify', value: 'justify', textAlign: 'justify' },
];

// Multiplier from base speed (220wpm)
export const READING_SPEED_OPTIONS: { label: string; value: ReadingSpeed; speed: number }[] = [
  { label: 'Snail pace', value: 'snail', speed: 0.25 },
  { label: 'Page-turner', value: 'slower', speed: 0.5 },
  { label: 'Slow', value: 'slow', speed: 0.75 },
  { label: 'Normal', value: 'normal', speed: 1 },
  { label: 'Fast', value: 'fast', speed: 1.5 },
  { label: 'Speed reader', value: 'faster', speed: 2 },
  { label: 'Lightning', value: 'turbo', speed: 3 },
  { label: 'Demon', value: 'crazy-style', speed: 4 }
];

// Nuxt UI's own components (buttons, popovers, selects, badges) follow the
// `.dark`/`.light` class on <html> via useColorMode(), independently of our
// --a11y-* page/card overrides below. Without syncing this too, picking an
// explicit reading theme would recolor the page background but leave every
// Nuxt UI control stuck on whatever the OS preference happens to be.
const COLOR_MODE_BY_THEME: Record<ReadingTheme, 'system' | 'light' | 'dark'> = {
  system: 'system',
  light: 'light',
  sepia: 'light',
  dark: 'dark',
  'high-contrast': 'dark',
};

const THEME_VARS: Record<Exclude<ReadingTheme, 'system'>, Record<string, string>> = {
  light: { '--a11y-bg': '#ffffff', '--a11y-card-bg': '#ffffff', '--a11y-text': '#18181b', '--a11y-muted': '#4b5563', '--a11y-border': '#e5e7eb' },
  dark: { '--a11y-bg': '#000000', '--a11y-card-bg': '#18181B', '--a11y-text': '#ffffff', '--a11y-muted': '#9ca3af', '--a11y-border': '#1f2937' },
  sepia: { '--a11y-bg': '#f4ecd8', '--a11y-card-bg': '#f4ecd8', '--a11y-text': '#5b4636', '--a11y-muted': '#7a6753', '--a11y-border': '#dcccae' },
  'high-contrast': { '--a11y-bg': '#000000', '--a11y-card-bg': '#000000', '--a11y-text': '#ffffff', '--a11y-muted': '#ffffff', '--a11y-border': '#ffffff' },
};

export function useReadingPreferences() {
  const preferences = useLocalStorage<ReadingPreferences>('reading-preferences', { ...DEFAULT_PREFERENCES }, { mergeDefaults: true });

  const colorMode = useColorMode();
  watch(
    () => preferences.value.theme,
    (theme) => {
      colorMode.preference = COLOR_MODE_BY_THEME[theme];
    },
    { immediate: true },
  );

  const themeStyle = computed(() => {
    const theme = preferences.value.theme;
    return theme === 'system' ? {} : THEME_VARS[theme];
  });

  const fontFamilyClass = computed(() => {
    return FONT_FAMILY_OPTIONS.find(o => o.value === preferences.value.fontFamily)?.class ?? '';
  });

  // Anchored to prose-lg's own documented base size (1.125rem) rather than a
  // percentage of the inherited font-size, so fontScale === 1 always matches
  // today's rendering exactly regardless of which ancestor rule would otherwise win.
  const proseStyle = computed(() => {
    const lineHeight = LINE_HEIGHT_OPTIONS.find(o => o.value === preferences.value.lineHeight)?.lineHeight ?? '1.75';
    const maxWidth = MEASURE_OPTIONS.find(o => o.value === preferences.value.measure)?.maxWidth ?? 'none';
    return {
      fontSize: `${Math.round(1.125 * preferences.value.fontScale * 10000) / 10000}rem`,
      lineHeight,
      letterSpacing: preferences.value.letterSpacing === 'wide' ? '0.05em' : 'normal',
      maxWidth,
      textAlign: preferences.value.textAlign,
    };
  });

  const wpmRate = computed(() => {
    const multiplier = READING_SPEED_OPTIONS.find(o => o.value === preferences.value.speed)?.speed ?? 1;
    return Math.round(BASE_WPM * multiplier)
  })

  function adjustFontScale(delta: number) {
    const next = Math.round((preferences.value.fontScale + delta) * 1000) / 1000;
    preferences.value.fontScale = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next));
  }

  function resetPreferences() {
    preferences.value = { ...DEFAULT_PREFERENCES };
  }

  return {
    preferences,
    themeStyle,
    fontFamilyClass,
    proseStyle,
    wpmRate,
    adjustFontScale,
    resetPreferences,
    fontScaleStep: FONT_SCALE_STEP,
    fontScaleMin: FONT_SCALE_MIN,
    fontScaleMax: FONT_SCALE_MAX,
  };
}
