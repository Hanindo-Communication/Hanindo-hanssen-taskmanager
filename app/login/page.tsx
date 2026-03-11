'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './login.module.css';

const WELCOME_STORAGE_KEY = 'task-manager.welcomeName';

const EMAIL_TO_NAME: Record<string, string> = {
  'hanssen@hanindo.co.id': 'Hanssen',
  'dinda@hanindo.co.id': 'Dinda',
  'handi@hanindo.co.id': 'Handi',
  'kezia@hanindo.co.id': 'Kezia',
  'vira@hanindo.co.id': 'Vira',
};

const MOOD_OPTIONS = [
  { id: 'senang', label: 'Senang', emoji: '😊' },
  { id: 'sakit', label: 'Sakit', emoji: '🤒' },
  { id: 'sedih', label: 'Sedih', emoji: '😢' },
  { id: 'ngantuk', label: 'Ngantuk', emoji: '😴' },
] as const;

function getDisplayName(email: string): string {
  const key = email.trim().toLowerCase();
  const beforeAt = key.split('@')[0] ?? '';
  const fallback = beforeAt ? beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1).toLowerCase() : 'there';
  return (EMAIL_TO_NAME[key] ?? fallback) || 'there';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
      setLoading(false);
      return;
    }
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    if (data.session) {
      sessionStorage.setItem(WELCOME_STORAGE_KEY, getDisplayName(email.trim()));
      if (mood) sessionStorage.setItem('task-manager.mood', mood);
      window.location.href = '/welcome';
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.layout}>
        {/* Left: Welcome + motivasi */}
        <section className={styles.left}>
          <h1 className={styles.welcomeTitle}>Welcome!</h1>
          <div className={styles.separator} />
          <div className={styles.motivasiWrap}>
            <p className={styles.motivasi}>
              Mulai hari dengan fokus. Satu tugas yang selesai hari ini lebih berharga dari seratus rencana besok.
            </p>
            <p className={styles.motivasi}>
              Kerja berkualitas lahir dari langkah kecil yang konsisten. Kamu bisa.
            </p>
          </div>
          <a href="/" className={styles.learnMore}>Learn More</a>
        </section>

        {/* Right: Form card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Sign in</h2>
          <div className={styles.separator} />

          <form className={styles.form} onSubmit={handleSubmit}>
            {error ? (
              <div className={styles.error} role="alert">
                {error}
              </div>
            ) : null}

            <label className={styles.label}>
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="you@hanindo.co.id"
                required
              />
            </label>

            <label className={styles.label}>
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
            </label>

            <div className={styles.moodSection}>
              <p className={styles.moodLabel}>How&apos;s your mood today?</p>
              <div className={styles.moodOptions} role="group" aria-label="Pilih mood">
                {MOOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={styles.moodBtn}
                    data-selected={mood === opt.id}
                    onClick={() => setMood(mood === opt.id ? null : opt.id)}
                    title={opt.label}
                  >
                    <span className={styles.moodEmoji}>{opt.emoji}</span>
                    <span className={styles.moodText}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Signing in…' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
