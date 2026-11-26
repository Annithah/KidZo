import { useState, type FormEvent } from 'react';
import { loginSchema } from '@kidzo/shared';
import { describeError } from '../api';
import { useAuth } from '../auth';
import { Art } from '../components/Art';
import { Icon } from '../components/Icon';
import { Button, Field } from '../components/ui';
import { useFormErrors } from '../form';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useFormErrors(loginSchema, { email, password });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.attempt()) return;
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-art" aria-hidden>
        <Art art="zo.waving" size={220} />
        <p>Create stories, games and songs that families love, and see how they are enjoyed.</p>
      </div>
      <div className="login-form">
        <form className="stack" onSubmit={submit} noValidate>
          <img src="/logo.png" alt="KIDZO" />
          <div>
            <p className="kicker">Content dashboard</p>
            <h1>Admin sign in</h1>
          </div>
          <Field label="Email" error={form.errors.email}>
            {(a11y) => <input {...a11y} className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => form.blur('email')} />}
          </Field>
          <Field label="Password" error={form.errors.password}>
            {(a11y) => <input {...a11y} className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => form.blur('password')} />}
          </Field>
          {error ? (
            <div className="alert error" role="alert">
              <Icon name="warning" size={18} />
              {error}
            </div>
          ) : null}
          <Button type="submit" icon="user" busy={busy}>
            {busy ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
