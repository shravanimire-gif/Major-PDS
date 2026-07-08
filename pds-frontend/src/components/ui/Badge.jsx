import cx from './cx';

// Single status→token mapping, shared by every badge use case in the app (ration
// card category, blockchain health, generic alerts). Callers map their own domain
// values onto this fixed set instead of Badge knowing about categories/health states:
//   - ration card category (RationCards.jsx getCategoryBadgeClass): APL -> info, BPL -> warning, other -> danger
//   - blockchain health (BlockchainHealthCard.jsx STATUS_META): healthy -> success, degraded -> warning, down -> danger
const STATUS_CLASSES = {
  neutral: 'bg-surface-muted text-text-secondary border-border',
  info: 'bg-info-bg text-info-text border-info-border',
  success: 'bg-success-bg text-success-text border-success-border',
  warning: 'bg-warning-bg text-warning-text border-warning-border',
  danger: 'bg-danger-bg text-danger-text border-danger-border',
};

// The *-text tokens double as solid dot colors — the *-bg tokens are pale tints and
// don't read as a status dot on their own (this is what replaces BlockchainHealthCard's
// separate `dot` class in STATUS_META).
const DOT_CLASSES = {
  neutral: 'bg-text-secondary',
  info: 'bg-info-text',
  success: 'bg-success-text',
  warning: 'bg-warning-text',
  danger: 'bg-danger-text',
};

const Badge = ({ status = 'neutral', dot = false, icon, children, className, ...props }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-0.5 text-xs font-medium',
      STATUS_CLASSES[status],
      className
    )}
    {...props}
  >
    {dot && <span className={cx('h-1.5 w-1.5 rounded-full', DOT_CLASSES[status])} aria-hidden="true" />}
    {icon}
    {children}
  </span>
);

export default Badge;
