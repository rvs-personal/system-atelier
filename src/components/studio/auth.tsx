'use client';
import { useContext, useEffect, useState } from 'react';
import {
  ArrowRight,
  KeyRound,
  LogOut,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import AuthLanding from './auth-landing';
import { download } from '@/lib/studio/storage';
import { AuthContext as Auth, type User } from '@/lib/auth/context';
export function AccountMenu() {
  const auth = useContext(Auth);
  const [claim, setClaim] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="account-menu">
      <span>
        Signed in as <strong>{auth?.user.username}</strong>
      </span>
      <button className="text-button" onClick={auth?.logout}>
        <LogOut size={14} />
        Sign out
      </button>
      <details>
        <summary>Import original private workspace</summary>
        <p className="small">
          For the original owner only. Enter your private import code. Existing
          data in this account will not be overwritten.
        </p>
        <input
          aria-label="Private import code"
          type="password"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
        />
        <button
          disabled={busy || !claim}
          className="secondary"
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Atelier-Account': auth?.user.id ?? '',
                },
                body: JSON.stringify({ action: 'claim', code: claim }),
              });
              const data = (await r.json()) as { error?: string };
              if (!r.ok) throw Error(data.error);
              window.location.reload();
            } catch (e) {
              setNotice((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Import & reload
        </button>
        <p role="status">{notice}</p>
      </details>
    </div>
  );
}
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [mode, setMode] = useState('login'),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [recovery, setRecovery] = useState(''),
    [newRecovery, setNewRecovery] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/auth');
      const d = (await r.json()) as { account: User | null; error?: string };
      if (!r.ok) throw Error(d.error);
      setUser(d.account);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, username, password, recovery }),
      });
      const d = (await r.json()) as {
        account: User;
        recovery?: string;
        error?: string;
      };
      if (!r.ok) throw Error(d.error);
      if (!d.recovery && location.hash === '#signin')
        history.replaceState(null, '', '#studio');
      setUser(d.account);
      setPassword('');
      setRecovery('');
      if (d.recovery) setNewRecovery(d.recovery);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    if (r.ok) window.location.reload();
    else setError('Could not sign out. Please retry.');
  }
  if (loading)
    return (
      <main className="auth-loading" role="status">
        Opening System Atelier…
      </main>
    );
  if (user && !newRecovery)
    return (
      <Auth.Provider value={{ user, logout }}>
        <div key={user.id}>
          {error && <p role="alert">{error}</p>}
          {children}
        </div>
      </Auth.Provider>
    );
  return (
    <AuthLanding>
      <div className="entry-form">
        {newRecovery ? (
          <>
            <KeyRound size={28} />
            <h1>Save your recovery key.</h1>
            <p>
              This is how you reset your password. We do not send recovery
              emails. Keep it in your password manager; anyone with this key can
              recover your account.
            </p>
            <code className="recovery-key">{newRecovery}</code>
            <button
              className="secondary wide"
              onClick={() =>
                download(
                  'system-atelier-recovery.txt',
                  `Username: ${user?.username}\nRecovery key: ${newRecovery}\nKeep this private. Recovery replaces this key.\n`,
                )
              }
            >
              <Download size={16} />
              Download recovery key
            </button>
            <button
              className="primary wide"
              onClick={() => {
                if (location.hash === '#signin')
                  history.replaceState(null, '', '#studio');
                setNewRecovery('');
              }}
            >
              I saved it · open my workspace
              <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <h1>
              {mode === 'signup'
                ? 'Create an account'
                : mode === 'recover'
                  ? 'Recover your account'
                  : 'Sign in'}
            </h1>
            <p>
              {mode === 'signup'
                ? 'A place for your notes, designs and interview practice.'
                : mode === 'recover'
                  ? 'Enter your recovery key and choose a new password.'
                  : 'Continue learning and open your saved work.'}
            </p>
            <form onSubmit={submit}>
              <label className="field">
                <span>Username</span>
                <input
                  name="username"
                  autoComplete="username"
                  value={username}
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9_]{3,32}"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    mode === 'signup' ? 'Choose a username' : 'Your username'
                  }
                />
                {mode === 'signup' && (
                  <small>
                    Letters, numbers and underscores. No email needed.
                  </small>
                )}
              </label>
              {mode === 'recover' && (
                <label className="field">
                  <span>Recovery key</span>
                  <input
                    type="password"
                    autoComplete="off"
                    required
                    value={recovery}
                    onChange={(e) => setRecovery(e.target.value)}
                  />
                </label>
              )}
              <label className="field">
                <span>{mode === 'recover' ? 'New password' : 'Password'}</span>
                <div className="password-entry">
                  {' '}
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {mode !== 'login' && <small>Use at least 12 characters.</small>}
              </label>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              {mode === 'signup' && (
                <p className="signup-recovery">
                  After signup, save your recovery key to reset your password.
                </p>
              )}
              <button className="primary wide" disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'signup'
                    ? 'Create account'
                    : mode === 'recover'
                      ? 'Reset password'
                      : 'Sign in'}
                <ArrowRight size={16} />
              </button>
            </form>
            <div className="auth-switch">
              {mode === 'signup' && <span>Already have an account?</span>}
              {['login', 'signup', 'recover']
                .filter(
                  (m) => m !== mode && (mode === 'login' || m === 'login'),
                )
                .map((m) => (
                  <button
                    className="text-button"
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError('');
                      setPassword('');
                    }}
                  >
                    {m === 'login'
                      ? 'Sign in'
                      : m === 'signup'
                        ? 'Create an account'
                        : 'Forgot password?'}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </AuthLanding>
  );
}
