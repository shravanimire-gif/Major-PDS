import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';
import cx from './cx';

const Pagination = ({ page, totalPages, onPageChange, className }) => {
  if (totalPages <= 1) return null;

  return (
    <div className={cx('flex items-center justify-between gap-4 px-4 py-3', className)}>
      <p className="text-xs text-text-secondary">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
