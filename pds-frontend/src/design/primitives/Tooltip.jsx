// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { cloneElement, useEffect, useId, useState } from 'react';
import cx from '../../components/ui/cx';

const OPEN_DELAY_MS = 200;

const PLACEMENT_CLASSES = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
  right: 'left-full top-1/2 ml-1.5 -translate-y-1/2',
};

/**
 * Small contextual hint shown near a trigger element on hover or keyboard
 * focus — use for brief clarifying text on icon-only buttons, truncated
 * labels, or disabled-state explanations. Not for content that itself needs
 * interaction; reach for Dialog or a popover for that instead.
 *
 * @param {Object} props
 * @param {string} props.content - Required tooltip text.
 * @param {React.ReactElement} props.children - The single trigger element the tooltip is attached to.
 * @param {'top'|'bottom'|'left'|'right'} [props.placement='top'] - Side of the trigger the tooltip appears on.
 */
function Tooltip({ content, children, placement = 'top' }) {
  // `active` tracks hover/focus intent; `visible` is the actual tooltip
  // display state, delayed behind `active` by OPEN_DELAY_MS via an effect.
  // Hiding is set directly in the leave/blur handlers so it takes effect
  // instantly instead of waiting on the effect to react to `active`.
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setVisible(true), OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const trigger = cloneElement(children, {
    onMouseEnter: (event) => {
      children.props.onMouseEnter?.(event);
      setActive(true);
    },
    onMouseLeave: (event) => {
      children.props.onMouseLeave?.(event);
      setActive(false);
      setVisible(false);
    },
    onFocus: (event) => {
      children.props.onFocus?.(event);
      setActive(true);
    },
    onBlur: (event) => {
      children.props.onBlur?.(event);
      setActive(false);
      setVisible(false);
    },
    'aria-describedby': visible
      ? [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' ')
      : children.props['aria-describedby'],
  });

  return (
    <span className="relative inline-block">
      {trigger}
      {visible ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cx(
            'absolute z-50 whitespace-nowrap rounded-ds-md bg-ds-overlay px-2 py-1',
            'text-ds-xs text-ds-text-inverse',
            PLACEMENT_CLASSES[placement]
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

export default Tooltip;
