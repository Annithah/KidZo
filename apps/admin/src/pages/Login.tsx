import { useState, type FormEvent } from 'react';
import { loginSchema } from '@kidzo/shared';
import { describeError } from '../api';
import { useAuth } from '../auth';
import { Field } from '../components/ui';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Enter a valid email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card stack" onSubmit={submit} noValidate>
        <img src="/logo.png" alt="KIDZO" />
        <p className="kicker" style={{ textAlign: 'center', margin: 0 }}>
          Content dashboard
        </p>
        <h1 style={{ textAlign: 'center' }}>Admin sign in</h1>
        <Field label="Email">
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? (
          <div className="alert error" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
