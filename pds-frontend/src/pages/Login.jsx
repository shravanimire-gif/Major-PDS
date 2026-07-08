import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/ui/Logo';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const resolveRolePath = (role) => {
  if (role === 'admin') {
    return '/admin/dashboard';
  }

  if (role === 'shopkeeper') {
    return '/shopkeeper/dashboard';
  }

  return null;
};

const getLoginErrorMessage = (apiError) => {
  const status = apiError.response?.status;

  if (status === 400 || status === 401) {
    return 'Invalid credentials';
  }

  if (!apiError.response) {
    return 'Unable to reach the server. Check that the backend is running.';
  }

  if (status === 404) {
    return 'Login service is unavailable. Check the API connection settings.';
  }

  return 'Unable to sign in right now. Please try again.';
};

const Login = () => {
  const navigate = useNavigate();
  const { isReady, user, login, logout } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    const nextPath = resolveRolePath(user?.role);

    if (isReady && nextPath) {
      navigate(nextPath, { replace: true });
    }
  }, [isReady, navigate, user]);

  const onSubmit = async (formData) => {
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', formData);
      const authenticatedUser = login(response.data.token);
      const nextPath = resolveRolePath(authenticatedUser?.role);

      if (!nextPath) {
        logout();
        setError('Unauthorized role');
        return;
      }

      navigate(nextPath, { replace: true });
    } catch (apiError) {
      setError(getLoginErrorMessage(apiError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <form
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-8 shadow-[var(--shadow-lg)]"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex justify-center">
          <Logo size={36} />
        </div>
        <h1 className="mt-4 text-center text-2xl font-semibold text-text-primary">Public Distribution System</h1>
        <p className="mt-2 text-center text-sm text-text-secondary">
          Sign in with your assigned admin or shopkeeper credentials.
        </p>

        <div className="mt-6 space-y-4">
          <Input
            label="Email"
            id="email"
            type="email"
            required
            error={errors.email}
            {...register('email', { required: 'Email is required' })}
          />

          <Input
            label="Password"
            id="password"
            type="password"
            required
            error={errors.password}
            {...register('password', { required: 'Password is required' })}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-sm border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="mt-6 w-full justify-center">
          {loading ? 'Signing in...' : 'Login'}
        </Button>
      </form>
    </div>
  );
};

export default Login;
