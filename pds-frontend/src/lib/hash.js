/**
 * Shortens a long identifier (hash, address, tx id) down to a fixed-width
 * "head…tail" form for display in tables/cards where the full value would
 * wrap or overflow. Use wherever a full value needs to stay copyable/
 * inspectable (e.g. via HashValue's tooltip) but shouldn't dominate the
 * layout. Falsy input or a value too short to usefully shorten is returned
 * unchanged rather than mangled.
 *
 * @param {string} value - The full value to shorten, e.g. "0x1234567890abcdef1234567890abcdef12345678".
 * @param {Object} [options]
 * @param {number} [options.head=6] - Number of leading characters to keep (for a "0x…" value this includes the "0x" prefix).
 * @param {number} [options.tail=4] - Number of trailing characters to keep.
 * @returns {string} `${value.slice(0, head)}…${value.slice(-tail)}`, or `value` unchanged if there's nothing to gain by truncating.
 */
export function truncateHash(value, { head = 6, tail = 4 } = {}) {
  if (!value) return value;
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Copies text to the clipboard, using the modern navigator.clipboard API
 * where available and falling back to a hidden textarea + execCommand
 * ('copy') for environments that don't expose it (e.g. non-HTTPS contexts
 * or older test/browser environments). Use for "nice to have" copy actions
 * (copy hash, copy id) — never rejects, so callers don't need a .catch just
 * to keep a failed copy from surfacing as an unhandled rejection.
 *
 * @param {string} text - The text to place on the clipboard.
 * @returns {Promise<boolean>} Resolves true on success, false if every copy method failed.
 */
export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false
    );
  }

  return new Promise((resolve) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      const succeeded = document.execCommand('copy');
      document.body.removeChild(textarea);
      resolve(succeeded);
    } catch {
      resolve(false);
    }
  });
}
