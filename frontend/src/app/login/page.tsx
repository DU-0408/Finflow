'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      redirect: false,
      username,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid username or password');
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-0)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated gradient background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 20% 50%, hsla(217, 91%, 60%, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, hsla(263, 70%, 58%, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, hsla(152, 69%, 45%, 0.04) 0%, transparent 50%)
        `,
      }} />

      <div style={{
        width: 400,
        maxWidth: '90vw',
        position: 'relative',
        zIndex: 1,
        animation: 'slideUp 500ms ease-out',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary), hsl(263, 70%, 58%))',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.4rem',
            color: 'white',
            marginBottom: 16,
            boxShadow: '0 8px 32px hsla(217, 91%, 60%, 0.2)',
          }}>
            FF
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            FinFlow Dashboard
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', marginTop: 4 }}>
            Banking Transaction Pipeline
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', fontSize: '0.8rem', fontWeight: 600,
                color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-4)',
                }} />
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: 40 }}
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block', fontSize: '0.8rem', fontWeight: 600,
                color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-4)',
                }} />
                <input
                  type="password"
                  className="input"
                  style={{ paddingLeft: 40 }}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--danger-bg)', color: 'var(--danger)',
                fontSize: '0.85rem', marginBottom: 20,
                animation: 'slideUp 200ms ease-out',
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 24, fontSize: '0.75rem',
          color: 'var(--text-4)',
        }}>
          Powered by FinFlow Pipeline v1.0
        </p>
      </div>
    </div>
  );
}
