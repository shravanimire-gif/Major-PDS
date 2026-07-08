import cx from './cx';

const Card = ({ header, footer, className, bodyClassName, children }) => (
  <div className={cx('rounded-md border border-border bg-surface shadow-sm', className)}>
    {header && <div className="border-b border-border px-5 py-4 text-lg font-semibold text-text-primary">{header}</div>}
    <div className={cx('p-5', bodyClassName)}>{children}</div>
    {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
  </div>
);

export default Card;
