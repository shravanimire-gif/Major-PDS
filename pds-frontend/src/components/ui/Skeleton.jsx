import cx from './cx';

const Skeleton = ({ className }) => (
  <div className={cx('animate-pulse rounded-sm bg-surface-muted', className)} aria-hidden="true" />
);

const Text = ({ width = 'w-full', className }) => <Skeleton className={cx('h-3', width, className)} />;

const Row = ({ columns = 4, className }) => (
  <div className={cx('flex items-center gap-4', className)}>
    {Array.from({ length: columns }, (_, index) => (
      <Skeleton key={index} className="h-3 flex-1" />
    ))}
  </div>
);

const Card = ({ className }) => (
  <div className={cx('space-y-3 rounded-md border border-border bg-surface p-5', className)}>
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-2/3" />
  </div>
);

Skeleton.Text = Text;
Skeleton.Row = Row;
Skeleton.Card = Card;

export default Skeleton;
