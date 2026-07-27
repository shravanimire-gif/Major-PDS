// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React from 'react';
import Tooltip from '../primitives/Tooltip';
import useToast from '../../components/ui/useToast';
import { truncateHash, copyToClipboard } from '../../lib/hash';
import cx from '../../components/ui/cx';

/**
 * Displays a long identifier (blockchain hash, address, tx id) shortened to
 * a fixed-width "head…tail" form, with the full value always available via
 * a hover/focus Tooltip. Use anywhere a hash/address/tx id needs to appear
 * in a table cell or card without blowing out the layout. When `copyable`
 * (the default), it's a real button: clicking it copies the full value to
 * the clipboard and confirms via the app's toast notifications; pass
 * `copyable={false}` for read-only, non-interactive display (renders a
 * plain span instead).
 *
 * @param {Object} props
 * @param {string} props.value - The full, untruncated value (hash, address, or tx id).
 * @param {number} [props.head] - Leading characters to keep — passed through to truncateHash.
 * @param {number} [props.tail] - Trailing characters to keep — passed through to truncateHash.
 * @param {boolean} [props.copyable=true] - Whether the value is clickable-to-copy.
 */
function HashValue({ value, head, tail, copyable = true }) {
  const toast = useToast();
  const truncated = truncateHash(value, { head, tail });

  const textClasses = 'font-mono-ds text-ds-mono-sm text-ds-text-primary';

  if (!copyable) {
    return (
      <Tooltip content={value}>
        <span className={textClasses}>{truncated}</span>
      </Tooltip>
    );
  }

  async function handleClick() {
    const succeeded = await copyToClipboard(value);
    if (succeeded) {
      toast.success('Copied to clipboard');
    }
  }

  return (
    <Tooltip content={value}>
      <button
        type="button"
        onClick={handleClick}
        className={cx(
          textClasses,
          'rounded-ds-sm hover:text-ds-accent transition-colors duration-ds-fast',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface'
        )}
      >
        {truncated}
      </button>
    </Tooltip>
  );
}

export default HashValue;
