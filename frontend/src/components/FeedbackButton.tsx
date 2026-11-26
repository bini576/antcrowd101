import { useState } from 'react';
import { submitFeedback } from '../services/authApi';
import { useAuth } from '../auth/AuthContext';

const CATEGORIES = [
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'general', label: 'General Feedback' },
];

export default function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!user) return null;

  const reset = () => {
    setSubject('');
    setCategory('general');
    setMessage('');
    setStatus('idle');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Subject and message are required.');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      await submitFeedback({ subject: subject.trim(), category, message: message.trim() });
      setStatus('sent');
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback.');
      setStatus('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send Feedback"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#fff',
          fontSize: 22,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => ((e.target as HTMLElement).style.transform = 'scale(1.1)')}
        onMouseLeave={(e) => ((e.target as HTMLElement).style.transform = 'scale(1)')}
      >
        💬
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); reset(); } }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              width: '100%',
              maxWidth: 440,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 16,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: 18 }}>Send Feedback</h3>
              <button type="button" onClick={() => { setOpen(false); reset(); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #475569',
                background: '#0f172a', color: '#e2e8f0', fontSize: 14, outline: 'none',
              }}
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #475569',
                background: '#0f172a', color: '#e2e8f0', fontSize: 14, outline: 'none',
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <textarea
              placeholder="Your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #475569',
                background: '#0f172a', color: '#e2e8f0', fontSize: 14, outline: 'none',
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />

            {error && <p style={{ color: '#f87171', margin: 0, fontSize: 13 }}>{error}</p>}
            {status === 'sent' && <p style={{ color: '#34d399', margin: 0, fontSize: 13 }}>✓ Feedback submitted. Thank you!</p>}

            <button
              type="submit"
              disabled={status === 'sending' || status === 'sent'}
              style={{
                padding: '10px 16px', borderRadius: 8, border: 'none',
                background: status === 'sent' ? '#059669' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: status === 'sending' ? 'wait' : 'pointer',
                transition: 'opacity 0.15s ease', opacity: status === 'sending' ? 0.7 : 1,
              }}
            >
              {status === 'sending' ? 'Sending...' : status === 'sent' ? 'Sent!' : 'Submit Feedback'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
