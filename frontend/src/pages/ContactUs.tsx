import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const initialState = {
  firstName: '',
  lastName: '',
  email: '',
  company: '',
  jobTitle: '',
  reason: '',
  phone: '',
  country: ''
};

const reasons = [
  { value: '', label: 'Select...' },
  { value: 'demo', label: 'Get started' },
  { value: 'sales', label: 'Speak with sales' },
  { value: 'partnerships', label: 'Partnerships' }
];

const countries = [
  { value: '', label: 'Select...' },
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'et', label: 'Ethiopia' }
];

export default function ContactUs() {
  const [form, setForm] = useState(initialState);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    // Simulate API call
    setTimeout(() => {
      setSubmitted(true);
      setSubmitting(false);
      navigate('/company/contact/thank-you');
    }, 1200);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(90deg, #191a2a 60%, #2b1e3c 100%)', padding: 0, margin: 0 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 24px', display: 'flex', gap: 48, alignItems: 'flex-start', justifyContent: 'center' }}>
        {/* Left content */}
        <div style={{ flex: 1, minWidth: 340 }}>
          <div style={{ color: '#e94fc6', fontWeight: 600, marginBottom: 12, fontSize: 18 }}>Get in touch</div>
          <h1 style={{ color: '#fff', fontWeight: 700, fontSize: 48, marginBottom: 18 }}>Speak with a security expert</h1>
          <div style={{ color: '#b0b0b0', fontSize: 20, marginBottom: 32 }}>
            We can help you detect and resolve vulnerabilities before they are exploited.
          </div>
          <div style={{ color: '#fff', fontSize: 18, marginBottom: 24 }}>
            Talk with us about our:
          </div>
          <ul style={{ color: '#e94fc6', fontSize: 18, marginBottom: 24, paddingLeft: 24 }}>
            <li style={{ marginBottom: 8 }}><span style={{ color: '#e94fc6', marginRight: 8 }}>✔</span>Products that combine advanced AI with human insights</li>
            <li style={{ marginBottom: 8 }}><span style={{ color: '#e94fc6', marginRight: 8 }}>✔</span>Community of 2M+ security researchers</li>
            <li style={{ marginBottom: 8 }}><span style={{ color: '#e94fc6', marginRight: 8 }}>✔</span>Dedicated customer success managers</li>
            <li><span style={{ color: '#e94fc6', marginRight: 8 }}>✔</span>Expert, 24/7 triage coverage</li>
          </ul>
        </div>
        {/* Right form */}
        <div style={{ flex: 1, minWidth: 380, maxWidth: 480, background: 'rgba(24,26,40,0.98)', borderRadius: 12, boxShadow: '0 4px 32px #0008', padding: 36 }}>
          <div style={{ color: '#e94fc6', fontWeight: 500, fontSize: 18, marginBottom: 18, textAlign: 'center' }}>
            Our team typically responds within 1 business day
          </div>
          {submitted ? (
            <div style={{ color: '#00e676', fontSize: 20, textAlign: 'center', margin: '48px 0' }}>
              Thank you! We have received your request.<br />Our team will be in touch soon.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#fff', fontWeight: 500 }}>First Name*</label>
                  <input name="firstName" value={form.firstName} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 8 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#fff', fontWeight: 500 }}>Last Name*</label>
                  <input name="lastName" value={form.lastName} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 8 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#fff', fontWeight: 500 }}>Business Email*</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 8 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#fff', fontWeight: 500 }}>Company*</label>
                  <input name="company" value={form.company} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 8 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#fff', fontWeight: 500 }}>Job Title*</label>
                  <input name="jobTitle" value={form.jobTitle} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 8 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#fff', fontWeight: 500 }}>Reason for Contact:*</label>
                  <select name="reason" value={form.reason} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 8 }}>
                    {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#fff', fontWeight: 500 }}>Phone (Optional)</label>
                  <input name="phone" value={form.phone} onChange={handleChange} style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 8 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#fff', fontWeight: 500 }}>Country*</label>
                  <select name="country" value={form.country} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', marginBottom: 8 }}>
                    {countries.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
                <div style={{ color: '#b0b0b0', fontSize: 13, marginBottom: 16 }}>
                  We will handle your contact details in line with our <Link to="/privacy-policy" style={{ color: '#7cb1ff' }}>Privacy Policy</Link>. If you prefer not to receive marketing emails from us, you can opt-out of all marketing communications or customize your preferences <a href="#" style={{ color: '#7cb1ff' }}>here</a>.
                </div>
              {error && <div style={{ color: '#ff5252', marginBottom: 12 }}>{error}</div>}
              <button type="submit" disabled={submitting} style={{ width: '100%', background: '#5c3bff', color: '#fff', fontWeight: 600, fontSize: 18, border: 'none', borderRadius: 6, padding: '12px 0', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Submitting...' : 'Submit'} <span aria-hidden="true">➜</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
