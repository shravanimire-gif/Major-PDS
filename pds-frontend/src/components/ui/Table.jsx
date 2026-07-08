import cx from './cx';
import Skeleton from './Skeleton';

// footer renders below the scrollable table body — pass a <Pagination> here for the
// "pagination footer" requirement instead of Table owning pagination state itself.
const Table = ({ children, className, footer }) => (
  <div className={cx('overflow-hidden rounded-md border border-border bg-surface', className)}>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
    {footer && <div className="border-t border-border">{footer}</div>}
  </div>
);

const Head = ({ children }) => (
  <thead className="sticky top-0 z-10 bg-surface-muted text-xs font-medium uppercase tracking-wider text-text-secondary">
    {children}
  </thead>
);

const Body = ({ children }) => <tbody>{children}</tbody>;

const Row = ({ children, className, ...props }) => (
  <tr
    className={cx('border-t border-border first:border-t-0 transition-colors hover:bg-surface-muted/60', className)}
    {...props}
  >
    {children}
  </tr>
);

const Cell = ({ header, numeric, children, className, ...props }) => {
  const Component = header ? 'th' : 'td';
  return (
    <Component
      scope={header ? 'col' : undefined}
      className={cx('px-4 py-3 text-text-primary', numeric && 'text-right tabular-nums', className)}
      {...props}
    >
      {children}
    </Component>
  );
};

// Full-width row for the "no rows" state — caller supplies colSpan to match its column count.
const Empty = ({ colSpan = 1, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-text-secondary">
      {children}
    </td>
  </tr>
);

// Full-width skeleton rows for the loading state — same colSpan contract as Empty.
const LoadingRows = ({ rows = 5, columns = 4 }) => (
  <>
    {Array.from({ length: rows }, (_, rowIndex) => (
      <tr key={rowIndex} className="border-t border-border">
        {Array.from({ length: columns }, (_, colIndex) => (
          <td key={colIndex} className="px-4 py-3">
            <Skeleton className="h-3 w-full" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

Table.Head = Head;
Table.Body = Body;
Table.Row = Row;
Table.Cell = Cell;
Table.Empty = Empty;
Table.LoadingRows = LoadingRows;

export default Table;
