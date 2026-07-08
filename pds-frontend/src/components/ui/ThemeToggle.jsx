import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import cx from './cx';

const ThemeToggle = ({ className }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-sm text-text-secondary transition hover:bg-surface-muted hover:text-text-primary',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        className
      )}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

export default ThemeToggle;
