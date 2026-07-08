import cx from './cx';

const EmptyState = ({ icon, title, description, action, className }) => (
  <div className={cx('flex flex-col items-center justify-center gap-1 px-4 py-12 text-center', className)}>
    {icon && (
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
        {icon}
      </div>
    )}
    {title && <p className="text-sm font-medium text-text-primary">{title}</p>}
    {description && <p className="text-xs text-text-secondary">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
