import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const resolveRolePath = (role) => {
  if (role === 'admin') {
    return '/admin/dashboard';
  }

  if (role === 'shopkeeper') {
    return '/shopkeeper/dashboard';
  }

  return null;
};

const Login = () => {
  const navigate = useNavigate();
  const { isReady, user, login, logout } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm({
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
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
      <form
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl"
        onSubmit={handleSubmit(onSubmit)}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-400">PDS Login</p>
        <h1 className="mt-3 text-3xl font-bold">Public Distribution System</h1>
        <p className="mt-2 text-sm text-gray-400">Sign in with your assigned admin or shopkeeper credentials.</p>

        <div className="mt-6">
          <label htmlFor="email" className="mb-2 block text-sm text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register('email', { required: true })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            required
          />
        </div>

        <div className="mt-4">
          <label htmlFor="password" className="mb-2 block text-sm text-gray-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            {...register('password', { required: true })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            required
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default Login;
