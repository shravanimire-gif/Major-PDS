import cx from './cx';

// Product mark: a ration-card motif (rounded card + wheat-tick) in the brand color.
// `variant="dark"` is for use on the chrome/sidebar background where surface tokens invert.
const Logo = ({ variant = 'light', size = 28, wordmark = true, className }) => (
  <div className={cx('inline-flex items-center gap-2', className)}>
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="28" height="20" rx="4" fill="var(--color-brand-500)" />
      <rect x="2" y="6" width="28" height="20" rx="4" stroke="var(--color-brand-700)" strokeWidth="1" />
      <circle cx="9" cy="16" r="3" fill="white" fillOpacity="0.9" />
      <rect x="15" y="12" width="11" height="2.4" rx="1.2" fill="white" fillOpacity="0.85" />
      <rect x="15" y="17.6" width="8" height="2.4" rx="1.2" fill="white" fillOpacity="0.65" />
    </svg>
    {wordmark && (
      <span
        className={cx(
          'text-base font-semibold tracking-tight',
          variant === 'dark' ? 'text-chrome-text' : 'text-text-primary'
        )}
      >
        PDS
      </span>
    )}
  </div>
);

export default Logo;
