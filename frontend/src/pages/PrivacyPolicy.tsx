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

const solutionItems = [
  'AI Security, Safety & Trust',
  'Application Security',
  'Continuous Security Testing',
  'Automotive & Transportation',
  'Financial Services',
  'Healthcare'
];

const partnerItems = ['Find A Channel Partner', 'Partner Portal'];
const researcherItems = ['Leaderboard', 'Disclosure Policy'];

const navMenus: Array<NavMenuWithItems | NavMenuWithSections> = [
  {
    label: 'Platform',
    items: [
      'Bug Bounty',
      'Pentest as a Service',
      'VDP',
      'Challenge',
      'Trust Center',
      'Training',
      'AI Red Teaming',
      'Code'
    ]
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
    label: 'Partners',
    items: ['Partner Overview', 'Technology Alliance', 'Hackerone and AWS', 'Find A Channel Partner', 'Partner Portal', 'Integration Partners']
  },
  {
    label: 'Researchers',
    items: ['Leaderboard', 'Disclosure Policy']
  },
  {
    label: 'Company',
    items: ['About Us', 'Careers']
  }
];

function getMenuItemPath(item: string) {
  const slug = item
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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
  if (solutionItems.includes(item)) return `/solutions/${slug}`;
  if (partnerItems.includes(item)) return `/partners/${slug}`;
  if (researcherItems.includes(item)) return `/researchers/${slug}`;
  if (item === 'Hackerone and AWS') return '/partners/hackerone-and-aws';
  if (item === 'Partner Overview') return '/partners';
  return '#';
}

const contactBlocks = [
  {
    title: 'United States & Worldwide',
    lines: [
      'Privacy Team',
      'AntCrowd Inc.',
      '548 Market Street, PMB 24734',
      'San Francisco, CA 94104'
    ]
  },
  {
    title: 'European Union',
    lines: [
      'Privacy Team',
      'AntCrowd B.V.',
      'Griffeweg 97/4',
      '9723 DV Groningen',
      'Netherlands'
    ]
  },
  {
    title: 'United Kingdom',
    lines: [
      'Privacy Team',
      'AntCrowd UK Limited',
      '4th Floor St. James House',
      'St. James Square',
      'Cheltenham, GL50 3PR'
    ]
  }
];

const dataCategories = [
  {
    name: 'Enquiry and Business Development',
    items: [
      'Name, contact details, and other information shared during requests',
      'Meeting transcripts, video, and audio (with your consent)'
    ],
    retention: '7 years (recordings removed after 30 days)',
    uses: 'Responding to enquiries, recording meetings, improving services, customer satisfaction, and pursuing legitimate interests.'
  },
  {
    name: 'Account Data',
    items: [
      'Username, password, email, profile/intro details, telephone, language, and location metadata',
      'Usage and content you provide while using the Services'
    ],
    retention: '7 years after the relationship ends',
    uses: 'Enable registration, login, access, payments, enforcement, and make profile data discoverable to other users and Community Members.'
  },
  {
    name: 'Payment Data',
    items: [
      'Name, contact details, payment accounts, tax documentation, transaction data, and vetting data'
    ],
    retention: '7 years post-relationship',
    uses: 'Facilitate payments to and from Community Members and customers, comply with AML/sanctions requirements.'
  },
  {
    name: 'Vetting Data',
    items: [
      'Date of birth, nationality, addresses, tax ID, identification documents (including images)'
    ],
    retention: 'Up to 7 years post-relationship',
    uses: 'Fraud, background, and sanctions checks for programs such as Clear or pentesting; compliance obligations.'
  },
  {
    name: 'Swag',
    items: [
      'Mailing address, phone number, clothing size'
    ],
    retention: '2 years (longer with consent)',
    uses: 'Ship rewards and maintain community recognition.'
  },
  {
    name: 'Recruitment',
    items: [
      'Resumes, education, employment history, references, recruiter data'
    ],
    retention: '7 years after relationship or 4 weeks if unsuccessful (extendable with consent)',
    uses: 'Determine suitability for roles; serve hiring needs.'
  },
  {
    name: 'Events',
    items: [
      'Name, email, company, job title, website'
    ],
    retention: '2 years (or longer with consent)',
    uses: 'Register attendees, share event details, improve experiences.'
  },
  {
    name: 'Survey Data',
    items: [
      'Responses to optional surveys'
    ],
    retention: '12 months (aggregate stats kept indefinitely)',
    uses: 'Inform business operations and understand the Community Member environment.'
  },
  {
    name: 'Analytics',
    items: [
      'Browser/device info, IP/MAC, location, clickstream, performance, errors'
    ],
    retention: 'Data deleted after 26 months; aggregates kept',
    uses: 'Product improvement, marketing relevance, ad performance.'
  },
  {
    name: 'Marketing/Messaging',
    items: [
      'Name, company, job title, contact information, trading preferences'
    ],
    retention: 'For the duration of the relationship',
    uses: 'Send promotional and transactional communications; maintain service updates.'
  }
];

export default function PrivacyPolicy() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navigate = useNavigate();
  const closeTimerRef = useRef<number | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openMenuNow(label: string) {
    clearCloseTimer();
    setOpenMenu(label);
  }

  function closeMenuSoon() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null);
    }, 180);
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      clearCloseTimer();
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="ant-page">
      <div className="ant-top-strip" />
      <header className="ant-nav-shell">
        <div className="ant-container ant-nav">
          <Link to="/" className="ant-logo">
            AntCrowd
          </Link>
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
                  aria-haspopup="menu"
                  aria-expanded={openMenu === menu.label}
                  onFocus={() => openMenuNow(menu.label)}
                  onClick={() => {
                    if (menu.label === 'Solution') {
                      setOpenMenu(null);
                      navigate('/solutions');
                      return;
                    }
                    if (menu.label === 'Partners') {
                      setOpenMenu(null);
                      navigate('/partners');
                      return;
                    }
                    if (menu.label === 'Researchers') {
                      setOpenMenu(null);
                      navigate('/researchers');
                    }
                  }}
                >
                  {menu.label}
                </button>
                {openMenu === menu.label && (
                  <div
                    className={`ant-nav-dropdown ${
                      menu.label === 'Platform' || menu.label === 'Platforms' ? 'ant-nav-dropdown-platform' : ''
                    } ${'sections' in menu ? 'ant-nav-dropdown-solution' : ''}`}
                    role="menu"
                    aria-label={`${menu.label} options`}
                    onMouseEnter={clearCloseTimer}
                    onMouseLeave={closeMenuSoon}
                  >
                    {'sections' in menu ? (
                      menu.sections.map((section) => (
                        <div key={section.title} className="ant-nav-section">
                          <span className="ant-nav-section-title">{section.title}</span>
                          <div className="ant-nav-section-links">
                            {section.items.map((item) => (
                              <Link key={item} to={getMenuItemPath(item)} onClick={() => setOpenMenu(null)}>
                                {item}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="ant-nav-section-links">
                        {menu.items.map((item) => (
                          <Link key={item} to={getMenuItemPath(item)} onClick={() => setOpenMenu(null)}>
                            {item}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="ant-actions">
            <Link to="/login" className="ant-login">
              Log in
            </Link>
            <button type="button" className="ant-demo-btn">
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="ant-container terms-page">
        <section className="terms-header">
          <span className="terms-eyebrow">Privacy</span>
          <h1>AntCrowd Privacy Policy</h1>
          <p className="terms-subtitle">Effective Date: 27 March 2025</p>
          <p>
            This Privacy Policy explains how AntCrowd and its affiliates (collectively, “AntCrowd”, “we”, “us”, or “our”) process your personal data when you use the AntCrowd Services,
            contact us, or otherwise interact with our platform.
          </p>
          <p>
            We may update this policy periodically. When we make material changes, we will notify you by email, a notice on the Services, or other means required by law.
          </p>
          <p>
            If you have questions or want to exercise your rights, contact privacy@antcrowd.com or the addresses listed below.
          </p>
        </section>

        <section className="terms-section">
          <h2>1. Who we are & controllers</h2>
          <p>
            AntCrowd Inc. (Delaware) is headquartered at 548 Market Street, PMB 24734, San Francisco, CA 94104. European and UK affiliates (AntCrowd B.V., AntCrowd UK Limited) and Pullrequest, LLC
            may act as controllers in certain jurisdictions and determine the means and purposes of processing your data.
          </p>
          <div className="terms-grid">
            {contactBlocks.map((block) => (
              <article key={block.title} className="terms-card">
                <h3>{block.title}</h3>
                {block.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </article>
            ))}
          </div>
          <p className="terms-note">
            Timeline: we try to respond within 30 days. If we need more time, we will explain the delay. If we cannot resolve your request, you may contact your local regulator (ICO, AP, or other EU/UK authority).
          </p>
          <p>
            For privacy inquiries in the U.S., you may also call +1 (855) 242-8699 (toll-free).
          </p>
        </section>

        <section className="terms-section">
          <h2>2. Your rights</h2>
          <p>
            Subject to applicable limitations, you may: request a copy or transfer of your data, restrict or stop processing, delete data, correct inaccuracies,
            object to processing, object to marketing, withdraw consent, and for California residents specifically: know what personal information is collected, know whether it is sold or shared,
            opt out of sale/sharing, access your information, and receive equal service and price even after exercising rights.
          </p>
          <p>Send requests to privacy@antcrowd.com. If we rely on consent, you may withdraw it by emailing that address.</p>
        </section>

        <section className="terms-section">
          <h2>3. Your personal data & how we use it</h2>
          <div className="terms-grid">
            {dataCategories.map((category) => (
              <article key={category.name} className="terms-card terms-card-detail">
                <h3>{category.name}</h3>
                <ul>
                  {category.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>
                  <strong>Retention:</strong> {category.retention}
                </p>
                <p>
                  <strong>Uses:</strong> {category.uses}
                </p>
              </article>
            ))}
          </div>
          <p>
            Recipients include cloud providers, analytics, and support partners such as AWS, Google, Stripe, Zoom, Salesforce, Intercom, Dropbox Sign, Docusign, Slack, Snowflake, Tray.IO, and others listed above.
          </p>
        </section>

        <section className="terms-section">
          <h2>4. Legal bases and transfers</h2>
          <p>
            We process your data to perform contracts, comply with legal obligations, pursue legitimate interests (service delivery, security, analytics, compliance), and with consent when required.
          </p>
          <p>
            Data may be transferred globally, including the U.S. and other jurisdictions with different privacy laws. We apply safeguards such as EU Standard Contractual Clauses, the EU-U.S. and UK Extension Data Privacy
            Frameworks, Swiss-U.S. Framework, or other mechanisms, and maintain a standard Data Processing Agreement that includes approved clauses.
          </p>
        </section>

        <section className="terms-section">
          <h2>5. Security, cookies, and responsibility</h2>
          <p>
            We maintain technical and organizational measures to protect your personal data, but please keep passwords secure, use strong authentication, and notify us if you suspect an account compromise.
          </p>
          <p>
            We and our third-party partners use cookies, pixels, and similar technologies. Refer to our Cookies Policy for details and how to manage preferences.
          </p>
        </section>

        <section className="terms-section">
          <h2>6. Data retention, enforcement, and disclosures</h2>
          <p>
            When specific retention periods are not noted, we keep data only as long as necessary, archive or delete it, and may retain public submissions indefinitely.
          </p>
          <p>
            We may process or disclose data to comply with law enforcement, protect rights, prevent fraud, defend AntCrowd, share aggregated information, or disclose during transactions (mergers, acquisitions, investments).
          </p>
        </section>

        <section className="terms-section">
          <h2>7. Framework complaints & arbitration</h2>
          <p>
            We comply with the EU-U.S. DPF, UK Extension, and Swiss-U.S. DPF. For complaints under those frameworks, email privacy@antcrowd.com (see section 1 contact info),
            and if unresolved file with JAMS DPF dispute resolution. FTC enforces our DPF compliance. Human-resources data under these frameworks fall under the guidance of EU DPAs, ICO, GRA, and FDPIC.
          </p>
          <p>
            Under certain conditions, binding arbitration may apply. See the government disclosures at dataprivacyframework.gov for details.
          </p>
        </section>

        <section className="terms-section">
          <h2>8. Marketing & messaging</h2>
          <p>
            You may receive marketing communications based on consent or legitimate interests (e.g., transactional notices). Manage preferences via the Email Subscription Preference Centre or click unsubscribe links in emails.
          </p>
          <p>We reserve the right to send necessary service updates even if you opt out of marketing.</p>
        </section>

        <section className="terms-section">
          <h2>9. CPRA notice</h2>
          <p>
            California residents also have CPRA rights including knowing what personal information we collect, whether we sell or share it, opting out of sale/sharing, accessing information, and receiving equal service even after exercising rights.
          </p>
          <p>We do not sell or share your personal information for cross-context behavioral advertising.</p>
        </section>

        <section className="terms-section">
          <p>Public vulnerability submissions remain visible after account deactivation. Account data may persist to fulfill enforcement or legal obligations.</p>
        </section>
      </main>

      <footer className="ant-bug-footer-wrap">
        <div className="ant-container ant-bug-footer-shell">
          <div className="ant-bug-footer-grid">
            <div className="ant-bug-col">
              <h4>Platform</h4>
              <Link to="/trust-center">Trust Center</Link>
              <Link to="/product/code">AntCrowd Code</Link>
              <Link to="/solutions">Solutions</Link>
            </div>
            <div className="ant-bug-col">
              <h4>Company</h4>
              <Link to="/company/about">About Us</Link>
              <Link to="/company/careers">Careers</Link>
              <Link to="/company/contact">Contact Us</Link>
            </div>
            <div className="ant-bug-col">
              <h4>Legal</h4>
              <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
              <Link to="/privacy-policy">Privacy Policy</Link>
            </div>
          </div>
          <div className="ant-bug-footer-bottom">
            <div className="ant-bug-brand">AntCrowd</div>
            <div className="ant-bug-footer-actions">
              <button type="button">Contact</button>
              <button type="button" className="accent">
                Get a Demo
              </button>
            </div>
          </div>
        </div>
        <div className="ant-container ant-bug-legal">
          <span>Copyright &copy;2026 AntCrowd</span>
          <div>
            <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <a href="#">Do Not Sell or Share My Information</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
