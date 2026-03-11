'use client';

import { useState, useRef, useEffect } from 'react';
import { AppShell } from '@/components/dashboard/app-shell';
import styles from '@/components/board/board-client.module.css';
import chatStyles from './chat-generator.module.css';

type Message = { role: 'user' | 'assistant'; content: string };

export default function ChatGeneratorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError(null);
    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal memanggil Mbah Dukun');
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.content ?? '' }]);
    } catch {
      setError('Koneksi gagal. Cek koneksi internet atau API key.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell activeSection="chat-generator">
      <section className={styles.overviewHero}>
        <div>
          <p className={styles.heroEyebrow}>👵 Mbah Dukun</p>
          <h2 className={styles.heroTitle}>👵 Mbah Dukun</h2>
          <p className={styles.heroDescription}>
            Tanya apa saja, Mbah Dukun akan menjawab lewat API Perplexity.
          </p>
        </div>

        <div className={chatStyles.chatWrap}>
          <div className={chatStyles.messages} ref={scrollRef}>
            {messages.length === 0 && !loading && (
              <p className={chatStyles.placeholder}>
                Ketik pertanyaan lalu kirim. Mbah Dukun siap menjawab.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === 'user' ? chatStyles.messageUser : chatStyles.messageAssistant
                }
              >
                <span className={chatStyles.messageRole}>
                  {msg.role === 'user' ? 'Kamu' : '👵 Mbah Dukun'}
                </span>
                <div className={chatStyles.messageContent}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className={chatStyles.messageAssistant}>
                <span className={chatStyles.messageRole}>👵 Mbah Dukun</span>
                <div className={chatStyles.messageContent}>
                  <span className={chatStyles.typing}>Mbah sedang meramal...</span>
                </div>
              </div>
            )}
          </div>

          {error && <p className={chatStyles.error}>{error}</p>}

          <form className={chatStyles.form} onSubmit={handleSubmit}>
            <textarea
              className={chatStyles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya Mbah Dukun..."
              rows={2}
              disabled={loading}
              aria-label="Pertanyaan untuk Mbah Dukun"
            />
            <button type="submit" className={chatStyles.submit} disabled={loading || !input.trim()}>
              {loading ? 'Tunggu...' : 'Kirim'}
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
