import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export const AuthPage: React.FC = () => {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResetMessage(null);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        await signUp(email, password);
      } else {
        await requestPasswordReset(email);
        setResetMessage('If an account exists for this email, a reset link has been sent.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPasswordFields = mode !== 'reset';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-6">FinanceApp</h1>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
          {mode === 'login'
            ? 'Sign in to access your dashboard.'
            : mode === 'signup'
            ? 'Create an account to get started.'
            : 'Enter your email to receive a password reset link.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {renderPasswordFields && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {resetMessage && <p className="text-sm text-green-600">{resetMessage}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-60"
          >
            {isSubmitting
              ? 'Please wait…'
              : mode === 'login'
              ? 'Log In'
              : mode === 'signup'
              ? 'Sign Up'
              : 'Send reset link'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
          {mode === 'login' && (
            <>
              <p>
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                >
                  Sign up
                </button>
              </p>
              <p>
                Forgot your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setError(null);
                    setResetMessage(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                >
                  Reset it
                </button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Log in
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p>
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setResetMessage(null);
                  setError(null);
                }}
                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Back to login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
