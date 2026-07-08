import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import Button from '../components/ui/Button';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-8 text-center shadow-[var(--shadow-lg)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-danger-border bg-danger-bg text-danger-text">
          <ShieldAlert size={24} />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-text-primary">Unauthorized</h1>
        <p className="mt-3 text-sm text-text-secondary">You don&apos;t have permission to view this page.</p>
        <Button variant="primary" className="mt-6" onClick={() => navigate('/login', { replace: true })}>
          Go to Login
        </Button>
      </div>
    </div>
  );
};

export default Unauthorized;
