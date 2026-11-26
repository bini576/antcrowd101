export default function ContactThankYou() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 900, width: '100%', padding: '48px 24px', display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ fontSize: 64, marginRight: 24 }}>
          <span role="img" aria-label="mail" style={{ position: 'relative', top: 8 }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="16" width="48" height="32" rx="4" stroke="#222" strokeWidth="4" fill="#fff" />
              <path d="M8 18L32 38L56 18" stroke="#222" strokeWidth="4" />
              <path d="M20 36L16 44" stroke="#FF8000" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 44, color: '#222', marginBottom: 12, display: 'inline-block' }}>
            Thank you for reaching out!
          </h1>
          <div style={{ color: '#222', fontSize: 20, marginTop: 8 }}>
            We’ll reach out in the next two business days. In the meantime, check out our latest resources below and get to know Bugcrowd.
          </div>
        </div>
      </div>
    </div>
  );
}
