/**
 * Design Foundation — JS mirror of the tokens registered in ./tokens.css.
 *
 * This is the single source of truth for raw values that CANNOT be expressed
 * as a Tailwind utility class — e.g. chart series colors passed as props to
 * `recharts`, or values read in JS (motion durations passed to a timeout).
 * For anything renderable via className, prefer the Tailwind utility named
 * in each entry's `className` field over importing the raw value.
 *
 * Every key here has a corresponding `ds`-prefixed CSS custom property in
 * ./tokens.css. Keep the two files in sync — do not add a token in one
 * without the other.
 */

/** @typedef {{ primary: string, primaryHover: string, primaryActive: string }} AccentTokens */
/** @typedef {{ success: string, warning: string, danger: string, info: string }} StatusTokens */

export const colors = {
  bg: {
    canvas: '#fafafa',
    surface: '#ffffff',
    surfaceAlt: '#fafafa',
    sunken: '#f5f5f5',
  },
  border: {
    subtle: '#e5e5e5',
    default: '#d4d4d4',
    strong: '#a3a3a3',
  },
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#737373',
    disabled: '#a3a3a3',
    inverse: '#ffffff',
  },
  /** Dialog backdrop (pair with 40% opacity) and solid dark surfaces (Tooltip) */
  overlay: '#171717',
  /** @type {AccentTokens} the ONLY hue used for primary actions, anywhere */
  accent: {
    primary: '#4f46e5', // indigo-600
    primaryHover: '#4338ca', // indigo-700
    primaryActive: '#3730a3', // indigo-800
  },
  /** @type {StatusTokens} reserved for status communication, never decoration */
  status: {
    success: '#059669', // emerald-600
    warning: '#d97706', // amber-600
    danger: '#e11d48', // rose-600
    info: '#0284c7', // sky-600
  },
  /**
   * Categorical series colors for charts (recharts `fill`/`stroke` props take
   * raw values, not CSS vars, so this is the source of truth — keep in sync
   * with the `--color-ds-chart-series-*` / `--color-ds-chart-other` custom
   * properties in tokens.css). Capped at 3 slots: see the comment on those
   * properties for why a donut/pie never grows a 4th.
   */
  chart: {
    series: ['#2a78d6', '#eb6834', '#1baf7a'],
    other: '#a3a3a3',
  },
};

/**
 * @typedef {Object} TypeStyle
 * @property {string} size - rem font-size
 * @property {string} lineHeight - rem line-height
 * @property {number} weight - 400 | 500 | 600
 * @property {string} className - Tailwind utilities that reproduce this style
 */

/** @type {Record<string, TypeStyle>} */
export const typography = {
  display: { size: '1.75rem', lineHeight: '2.25rem', weight: 600, className: 'text-ds-display font-semibold' },
  title: { size: '1.25rem', lineHeight: '1.75rem', weight: 600, className: 'text-ds-title font-semibold' },
  subtitle: { size: '1rem', lineHeight: '1.5rem', weight: 600, className: 'text-ds-subtitle font-semibold' },
  body: { size: '0.875rem', lineHeight: '1.25rem', weight: 400, className: 'text-ds-body font-normal' },
  bodyStrong: { size: '0.875rem', lineHeight: '1.25rem', weight: 500, className: 'text-ds-body font-medium' },
  small: { size: '0.8125rem', lineHeight: '1.125rem', weight: 400, className: 'text-ds-small font-normal' },
  xs: {
    size: '0.75rem',
    lineHeight: '1rem',
    weight: 500,
    className: 'text-ds-xs font-medium uppercase tracking-wide',
  },
  monoSm: { size: '0.8125rem', lineHeight: '1.125rem', weight: 400, className: 'font-mono-ds text-ds-mono-sm' },
};

/**
 * Tailwind's default 4px spacing scale, aliased semantically. These are
 * documentation-only — no new CSS is generated, since the referenced
 * Tailwind utility already exists. Use the className directly in JSX.
 */
export const spacing = {
  formGap: { step: 4, px: 16, className: 'gap-4' },
  sectionGap: { step: 6, px: 24, className: 'gap-6' },
  panelInner: { step: 5, px: 20, className: 'p-5' },
  pageXDesktop: { step: 8, px: 32, className: 'px-8' },
  pageY: { step: 6, px: 24, className: 'py-6' },
};

export const radii = {
  sm: { px: 4, className: 'rounded-ds-sm' },
  md: { px: 6, className: 'rounded-ds-md' },
  lg: { px: 8, className: 'rounded-ds-lg' },
};

/** shadow.none is the default — prefer borders. Never use a shadow on a card/panel. */
export const shadows = {
  none: { className: 'shadow-none' },
  sm: { className: 'shadow-ds-sm' },
  md: { className: 'shadow-ds-md' },
};

export const motion = {
  duration: {
    instant: { ms: 0, className: 'duration-ds-instant' },
    fast: { ms: 120, className: 'duration-ds-fast' },
    base: { ms: 180, className: 'duration-ds-base' },
    slow: { ms: 280, className: 'duration-ds-slow' },
  },
  easing: {
    standard: { value: 'cubic-bezier(0.2, 0, 0, 1)', className: 'ease-ds-standard' },
    emphasized: { value: 'cubic-bezier(0.2, 0, 0, 1)', className: 'ease-ds-emphasized' },
  },
};
