// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import cx from '../../components/ui/cx';
import Checkbox from '../primitives/Checkbox';

/**
 * A small, purpose-built multi-select dropdown for filter rows — e.g. the
 * Anomalies page's "Severity" filter. The Select primitive only wraps a
 * native <select>, which can't represent "zero or more values checked"
 * well, so this composes the Checkbox primitive inside a popover instead
 * of trying to be a Select variant. Use it whenever a filter needs to pick
 * several values from a short, known list and show the live count on a
 * compact trigger.
 *
 * @param {Object} props
 * @param {Array<{value: string, label: string}>} props.options - The selectable options, e.g. [{value:'critical',label:'Critical'}].
 * @param {Array<string>} props.selected - Currently-selected option values.
 * @param {(next: Array<string>) => void} props.onChange - Called with the full next selected array whenever an option is checked/unchecked.
 * @param {string} props.label - Used as the trigger button's visible text/accessible name, e.g. "Severity".
 */
function SeverityMultiSelect({ options, selected, onChange, label }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const panelId = useId();

  // Closes on outside click or Escape only — selecting an option must NOT
  // close the panel, so those two listeners are the only close triggers.
  // Same click-away pattern as AnomalyBadge.jsx: a ref around the whole
  // trigger+panel and a document-level mousedown listener added only while
  // open. Both setOpen calls below happen inside event-listener callbacks,
  // not synchronously in the effect body, so this doesn't trip
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!open) return undefined;

    const handleClickAway = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function toggleOption(value) {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(next);
  }

  const triggerText = selected.length > 0 ? `${label} (${selected.length})` : label;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className={cx(
          'inline-flex items-center gap-2 rounded-ds-md border border-ds-default bg-ds-surface px-3 py-2 text-ds-body text-ds-text-primary',
          'transition-colors duration-ds-fast ease-ds-standard',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface'
        )}
      >
        {triggerText}
        <ChevronDown aria-hidden="true" size={16} className="text-ds-text-tertiary" />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className="absolute left-0 z-20 mt-1 min-w-[10rem] rounded-ds-md border border-ds-subtle bg-ds-surface p-2 shadow-ds-sm"
        >
          <div className="flex flex-col gap-1.5">
            {options.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={selected.includes(option.value)}
                onChange={() => toggleOption(option.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SeverityMultiSelect;
