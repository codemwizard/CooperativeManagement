import React, { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthenticationApiError, changePassword, login, readSession } from '../api/auth-client.js';
import '../styles/auth.css';

type LoginState = 'checking-session' | 'idle' | 'loading' | 'error' | 'change-password' | 'password-updated';

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [credential, setCredential] = useState('');
  const [currentCredential, setCurrentCredential] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<LoginState>('checking-session');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const title = state === 'change-password' ? 'Change password'
      : state === 'password-updated' ? 'Password updated' : 'Sign in';
    document.title = `${title} | Symphony Workspace`;
  }, [state]);
  useEffect(() => {
    if (state === 'idle' || state === 'change-password' || state === 'password-updated') {
      document.querySelector<HTMLElement>('#main-content h1')?.focus({ preventScroll: true });
    }
  }, [state]);

  useEffect(() => {
    let active = true;
    void readSession().then((session) => {
      if (!active) return;
      if (session.forcedChangeRequired) setState('change-password');
      else navigate('/workspace', { replace: true });
    }).catch(() => {
      if (active) setState('idle');
    });
    return () => { active = false; };
  }, [navigate]);

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setState('loading');
    setError(null);
    try {
      const result = await login({ userId, credential, deviceId: crypto.randomUUID() });
      if (result.forcedChangeRequired) {
        setCurrentCredential(credential);
        setCredential('');
        setState('change-password');
      } else {
        setCredential('');
        navigate('/workspace', { replace: true });
      }
    } catch (cause) {
      setState('error');
      setError(cause instanceof AuthenticationApiError && cause.status === 0
        ? 'Unable to connect. Please try again.'
        : 'Sign in failed. Please check your credentials and try again.');
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (Array.from(newPassword).length < 12 || Array.from(newPassword).length > 1024) {
      setError('Choose a password between 12 and 1024 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setState('loading');
    try {
      await changePassword({ currentCredential, newPassword });
      setCurrentCredential('');
      setNewPassword('');
      setConfirmPassword('');
      setState('password-updated');
    } catch (cause) {
      setState('change-password');
      if (cause instanceof AuthenticationApiError && cause.code === 'INVALID_REQUEST') {
        setError('The new password is not accepted. Check the password requirements and try again.');
      } else {
        setError('Password could not be changed. Sign in again and retry.');
      }
    }
  }

  if (state === 'checking-session') {
    return <main id="main-content" aria-busy="true"><a className="workspace-skip-link" href="#main-content">Skip to main content</a><p role="status">Checking your session…</p></main>;
  }

  if (state === 'password-updated') {
    return (
      <main id="main-content" className="auth-page">
        <a className="workspace-skip-link" href="#main-content">Skip to main content</a>
        <section className="auth-card" aria-labelledby="password-updated-heading">
          <h1 id="password-updated-heading" tabIndex={-1}>Password updated</h1>
          <p>Your password was changed. Sign in with your new password to continue.</p>
          <button type="button" onClick={() => { setState('idle'); setUserId(''); }}>
            Return to sign in
          </button>
        </section>
      </main>
    );
  }

  if (state === 'change-password' || (state === 'loading' && currentCredential)) {
    return (
      <main id="main-content" className="auth-page">
        <a className="workspace-skip-link" href="#main-content">Skip to main content</a>
        <section className="auth-card" aria-labelledby="change-password-heading">
          <h1 id="change-password-heading" tabIndex={-1}>Change your password</h1>
          <p>Your account uses a temporary credential. Set a new password before continuing.</p>
          {error && <div role="alert" aria-live="assertive">{error}</div>}
          <form onSubmit={(event) => { void handlePasswordChange(event); }} aria-busy={state === 'loading'}>
            <label htmlFor="current-credential">Current temporary credential</label>
            <input id="current-credential" type="password" autoComplete="current-password" required
              value={currentCredential} onChange={(event) => setCurrentCredential(event.target.value)} />
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" required
              minLength={12} maxLength={1024} value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)} />
            <p id="password-requirement">Use 12 to 1024 characters. Spaces and passphrases are allowed.</p>
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required
              minLength={12} maxLength={1024} value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)} />
            <button type="submit" disabled={state === 'loading'} aria-busy={state === 'loading'}>
              {state === 'loading' ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="auth-page">
      <a className="workspace-skip-link" href="#main-content">Skip to main content</a>
      <section className="auth-card" aria-labelledby="login-heading">
        <h1 id="login-heading" tabIndex={-1}>Sign in to Symphony</h1>
        {error && <div role="alert" aria-live="assertive" data-testid="login-error">{error}</div>}
        <form onSubmit={(event) => { void handleLogin(event); }} aria-busy={state === 'loading'}>
          <label htmlFor="email">Email or user ID</label>
          <input id="email" type="text" autoComplete="username" required value={userId}
            onChange={(event) => setUserId(event.target.value)} disabled={state === 'loading'} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={credential}
            onChange={(event) => setCredential(event.target.value)} disabled={state === 'loading'} />
          <button type="submit" disabled={state === 'loading'} aria-busy={state === 'loading'}>
            {state === 'loading' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
