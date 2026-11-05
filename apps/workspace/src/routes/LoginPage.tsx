/**
 * apps/workspace/src/routes/LoginPage.tsx
 *
 * Login page — email/userId + password form.
 * On success: redirects to /workspace.
 * On failure: shows error message.
 * On temporary credential: prompts password change.
 * WP-1.9.5
 */

import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type LoginState = 'idle' | 'loading' | 'error' | 'change-password';

interface LoginError {
  readonly message: string;
}

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [error, setError] = useState<LoginError | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setState('loading');
    setError(null);

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const body = (await res.json()) as { requiresPasswordChange?: boolean };
        if (body.requiresPasswordChange) {
          setState('change-password');
        } else {
          navigate('/workspace', { replace: true });
        }
        return;
      }

      // Handle error responses
      let detail = 'Sign in failed. Please check your credentials and try again.';
      try {
        const body = (await res.json()) as { detail?: string };
        if (typeof body.detail === 'string' && body.detail.length > 0) {
          detail = body.detail;
        }
      } catch {
        // ignore parse error
      }

      setState('error');
      setError({ message: detail });
    } catch {
      setState('error');
      setError({ message: 'Unable to connect. Please try again.' });
    }
  }

  if (state === 'change-password') {
    return (
      <main id="main-content" style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.heading}>Change your password</h1>
          <p style={styles.info}>
            Your account uses a temporary credential. You must set a new password before
            continuing.
          </p>
          <p>
            <a href="/auth/change-password" style={styles.link}>
              Set new password
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Sign in to Symphony</h1>

        {state === 'error' && error && (
          <div
            role="alert"
            aria-live="assertive"
            style={styles.errorBox}
            data-testid="login-error"
          >
            {error.message}
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              Email or user ID
            </label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              aria-required="true"
              disabled={state === 'loading'}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              aria-required="true"
              disabled={state === 'loading'}
            />
          </div>

          <button
            type="submit"
            style={styles.submitBtn}
            disabled={state === 'loading'}
            aria-busy={state === 'loading'}
          >
            {state === 'loading' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8f9fa',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  card: {
    background: '#ffffff',
    borderRadius: '0.5rem',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  heading: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#212529',
  },
  errorBox: {
    background: '#fff5f5',
    border: '1px solid #feb2b2',
    color: '#c53030',
    borderRadius: '0.25rem',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  field: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#495057',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '0.25rem',
    fontSize: '1rem',
    color: '#212529',
    background: '#ffffff',
    boxSizing: 'border-box' as const,
  },
  submitBtn: {
    display: 'block',
    width: '100%',
    padding: '0.625rem 1rem',
    background: '#2c3e6b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.25rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '1.5rem',
  },
  info: {
    color: '#495057',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    marginBottom: '1rem',
  },
  link: {
    color: '#2c3e6b',
    fontWeight: 600,
  },
};

