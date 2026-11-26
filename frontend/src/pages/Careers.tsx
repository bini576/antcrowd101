import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type NavMenuSection = {
  title: string;
  items: string[];
};

type NavMenuWithItems = {
  label: string;
  items: string[];
};

type NavMenuWithSections = {
  label: string;
  sections: NavMenuSection[];
};

const navMenus: Array<NavMenuWithItems | NavMenuWithSections> = [
  {
    label: 'Platform',
    items: ['Bug Bounty', 'Pentest as a Service', 'VDP', 'Challenge', 'Trust Center', 'Training', 'AI Red Teaming', 'Code']
  },
  {
    label: 'Solution',
    sections: [
      {
        title: 'Use Cases',
        items: ['AI Security, Safety & Trust', 'Application Security', 'Continuous Security Testing']
      },
      {
        title: 'Industries',
        items: ['Automotive & Transportation', 'Financial Services', 'Healthcare']
      }
    ]
  },
  {
    label: 'Company',
    items: ['About Us', 'Careers', 'Contact']
  }
];

export default function Careers() {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const values = [
    { title: 'Think Like a Hacker', desc: 'We value curiosity, persistence, and unconventional thinking.' },
    { title: 'Trust & Transparency', desc: 'We build relationships on honesty and open communication.' },
    { title: 'Impact Driven', desc: 'We focus on results that make the internet measurably safer.' }
  ];

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openMenuNow(menuLabel: string) {
    clearCloseTimer();
    setOpenMenu(menuLabel);
  }

  function closeMenuSoon() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null);
    }, 180);
  }

  function getMenuItemPath(item: string) {
    const slug = item.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (item === 'Trust Center') return '/product/trust-center';
    if (item === 'Pentest as a Service') return '/product/pentest';
    if (item === 'Bug Bounty') return '/product/bug-bounty';
    if (item === 'Challenge') return '/product/challenge';
    if (item === 'AI Red Teaming') return '/product/ai-red-teaming';
    if (item === 'VDP') return '/product/vdp';
    if (item === 'Training') return '/product/training';
    if (item === 'Code') return '/product/code';
    if (item === 'About Us') return '/company/about';
    if (item === 'Careers') return '/company/careers';
    if (item === 'Contact') return '/company/contact';
    const solutionItems = ['AI Security, Safety & Trust', 'Application Security', 'Continuous Security Testing', 'Automotive & Transportation', 'Financial Services', 'Healthcare'];
    if (solutionItems.includes(item)) return `/solutions/${slug}`;
    return '#';
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('keydown', handleEscape);
    return () => { clearCloseTimer(); document.removeEventListener('keydown', handleEscape); };
  }, []);

  return (
    <div className="ant-page">
      <div className="ant-top-strip" />
      <header className="ant-nav-shell">
        <div className="ant-container ant-nav">
          <Link to="/" className="ant-logo">AntCrowd</Link>
          <nav aria-label="Main" className="ant-links">
            {navMenus.map((menu) => (
              <div
                key={menu.label}
                className="ant-nav-menu"
                onMouseEnter={() => openMenuNow(menu.label)}
                onMouseLeave={closeMenuSoon}
              >
                <button
                  type="button"
                  className="ant-nav-toggle"
                  onClick={() => { if (menu.label === 'Solution') navigate('/solutions'); }}
                >
                  {menu.label}
                </button>
                {openMenu === menu.label && (
                  <div className="ant-nav-dropdown" onMouseEnter={clearCloseTimer} onMouseLeave={closeMenuSoon}>
                    {'sections' in menu ? (
                      menu.sections.map((sec) => (
                        <div key={sec.title} className="ant-nav-section">
                          <span className="ant-nav-section-title">{sec.title}</span>
                          <div className="ant-nav-section-links">
                            {sec.items.map((it) => (
                              <Link key={it} to={getMenuItemPath(it)} onClick={() => setOpenMenu(null)}>{it}</Link>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      menu.items.map((it) => (
                        <Link key={it} to={getMenuItemPath(it)} onClick={() => setOpenMenu(null)}>{it}</Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="ant-actions">
            <Link to="/login" className="ant-login">Log in</Link>
            <button type="button" className="ant-demo-btn">Get Started</button>
          </div>
        </div>
      </header>

      <main className="careers-page ant-container">
        <section className="careers-hero">
          <div className="careers-hero-inner">
            <span className="careers-eyebrow">Careers</span>
            <h1>Help us secure the world</h1>
            <p className="careers-subtitle">
              Join a remote-first team of security enthusiasts, engineers, and problem solvers.
            </p>
            <button type="button" className="careers-hero-cta">View Openings</button>
          </div>
        </section>

        <section className="careers-values">
          <div className="careers-container">
            <h2>Our Values</h2>
            <div className="values-grid">
              {values.map(v => (
                <div key={v.title} className="value-card">
                  <h3>{v.title}</h3>
                  <p>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="careers-benefits">
          <div className="careers-container">
            <h2>Why AntCrowd?</h2>
            <div className="benefits-list">
              <p>✓ Remote-first culture with global collaboration</p>
              <p>✓ Competitive salary and equity packages</p>
              <p>✓ Learning and development stipend</p>
              <p>✓ Health and wellness focus</p>
            </div>
          </div>
        </section>

        <section className="careers-footer-cta">
          <div className="careers-container">
            <h3>Don't see a perfect fit?</h3>
            <p>We're always looking for talented people. Reach out anyway!</p>
            <Link to="/company/contact">Get in touch ➜</Link>
          </div>
        </section>
      </main>

      <footer className="ant-bug-footer-wrap">
        <div className="ant-container ant-bug-footer-shell">
          <div className="ant-bug-footer-grid">
            <div className="ant-bug-col">
              <h4>Platform</h4>
              <Link to="/trust-center">Trust Center</Link>
              <Link to="/product/code">AntCrowd Code</Link>
              <a href="#">Bug Bounty</a>
            </div>
            <div className="ant-bug-col">
              <h4>Use cases</h4>
              <Link to="/solutions/ai-security-safety-and-trust">AI Security, Safety & Trust</Link>
              <Link to="/solutions/application-security">Application Security</Link>
              <Link to="/solutions/continuous-security-testing">Continuous Security Testing</Link>
            </div>
            <div className="ant-bug-col">
              <h4>Industries</h4>
              <Link to="/solutions/automotive-and-transportation">Automotive & Transportation</Link>
              <Link to="/solutions/financial-services">Financial Services</Link>
              <Link to="/solutions/healthcare">Healthcare</Link>
            </div>
            <div className="ant-bug-col">
              <h4>Company</h4>
              <Link to="/company/about">About Us</Link>
              <Link to="/company/careers">Careers</Link>
              <Link to="/company/contact">Contact Us</Link>
            </div>
          </div>
          <div className="ant-bug-footer-bottom">
            <div className="ant-bug-brand">AntCrowd</div>
            <div className="ant-bug-footer-actions">
              <button type="button" className="accent">Get Started</button>
            </div>
          </div>
        </div>
        <div className="ant-container ant-bug-legal">
          <span>Copyright &copy;2026 AntCrowd</span>
          <div>
            <a href="/trust">Security & Trust</a>
            <Link to="/privacy-policy">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
