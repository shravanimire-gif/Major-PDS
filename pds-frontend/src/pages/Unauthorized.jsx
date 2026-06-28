import { useNavigate } from 'react-router-dom';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl">
        <p className="text-4xl">⛔</p>
        <h1 className="mt-4 text-3xl font-bold">Unauthorized</h1>
        <p className="mt-3 text-sm text-gray-400">You don&apos;t have permission to view this page.</p>
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white transition hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
