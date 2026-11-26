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
  'Healthcare',
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

export default function TermsAndConditions() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navigate = useNavigate();
  const closeTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    }
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
          <span className="terms-eyebrow">Legal</span>
          <h1>AntCrowd Customer Terms and Conditions</h1>
          <p className="terms-subtitle">Effective Date: July 20, 2024</p>
          <p>
            These Customer Terms and Conditions apply to every Order Form entered on or after July 20, 2024, as well as all free trials,
            Community Edition customers, and anyone using the AntCrowd Services without an Order Form as of that date.
          </p>
          <p>
            Welcome to AntCrowd! Please read the Terms (including the General Terms and Conditions that are incorporated by reference) carefully before using the Services.
            Access is conditioned on agreeing to both the Customer Terms and the General Terms. Contact us if you have questions about these documents.
          </p>
        </section>

        <section className="terms-section">
          <h2>1. Agreement to terms</h2>
          <p>
            A Customer agrees to be bound by these Customer Terms and Conditions and the General Terms and Conditions whenever the Customer uses the Services.
            Access or use is prohibited unless the Customer expressly accepts this entire agreement.
          </p>
        </section>

        <section className="terms-section">
          <h2>2. Definitions</h2>
          <p>Certain capitalized terms used throughout these Terms are defined in the General Terms and Conditions.</p>
        </section>

        <section className="terms-section">
          <h2>3. Services</h2>
          <p>
            The Customer may use the AntCrowd Platform and Services solely for its or its Affiliates’ business purposes to connect with Community Members,
            create Programs, and offer Rewards under the scope set by an Order Form or other written agreement.
          </p>
          <p>
            AntCrowd may change any aspect of the Platform or Services at any time so long as the change complies with these Terms and does not reduce the Services owed to the Customer.
          </p>
          <p>Restrictions (the Customer shall not, and shall not permit any third party to):</p>
          <ul>
            <li>reverse engineer, decompile, or otherwise attempt to discover AntCrowd’s source code or underlying technology;</li>
            <li>modify, translate, combine, copy, rent, lease, distribute, pledge, assign, or otherwise transfer or encumber rights to the Services;</li>
            <li>use the Services for the benefit of a third party, compete with AntCrowd, remove proprietary notices, or interfere with the Service or connected systems;</li>
            <li>build competitive products, bypass access controls, or misuse the Services in violation of applicable laws (data privacy, export controls, international communications, etc.); and</li>
            <li>request Community Members to test third-party software, services, or infrastructure unless the Customer has all required rights and authorizations.</li>
          </ul>
          <p>
            If an Order Form includes Third Party Services, the Customer must comply with those third-party terms and pay AntCrowd within thirty (30) days of an invoice.
            AntCrowd is not responsible for third-party warranties or representations.
          </p>
          <p>
            If a Customer or its employee accesses the Services as a Community Member, the Community Member Terms govern that access in addition to these Customer Terms.
          </p>
        </section>

        <section className="terms-section">
          <h2>4. Community Members & Output</h2>
          <p>Community Members and their submissions are independent third parties. AntCrowd does not endorse any Community Member or guarantee any submission.</p>
          <p>The Customer assumes all risk when selecting, communicating with, or relying on Community Members or their Output, and any contractual remedy resides solely with the Community Member.</p>
          <p>Community Member Reviews and Output descriptions are provided “as is,” without endorsement. AntCrowd disclaims liability for errors, omissions, or damages stemming from reliance on any Community Member Submission.</p>
        </section>

        <section className="terms-section">
          <h2>5. Rewards & AntCrowd Fees</h2>
          <p>
            Customers must pre-fund Rewards before AntCrowd transfers funds to Community Members. Transfers depend on AntCrowd’s receipt of complete Reward funds,
            the Customer’s validation of Submissions, any required KYC/AML checks, tax documentation, and successful regulatory screenings (e.g., OFAC).
          </p>
          <p>
            AntCrowd acts as agent for Community Members with respect to monetary Rewards. Customers acknowledge their payments discharge obligations owed to Community Members.
          </p>
          <p>
            Unless otherwise specified, AntCrowd Fees equal twenty percent (20%) of each monetary Reward. Fees and undisputed amounts are due within thirty (30) days of the invoice,
            and overdue balances accrue interest at 1.5% per month (or the maximum legal rate), plus collection costs and attorneys’ fees.
          </p>
          <p>The Customer is responsible for all duties, customs, fees, or taxes (including withholding) triggered by using the Services.</p>
          <p>If a Services agreement terminates, AntCrowd may transfer outstanding Rewards under the Program Policy and normal validation timelines.</p>
        </section>

        <section className="terms-section">
          <h2>6. Programs & Program Materials</h2>
          <p>
            AntCrowd may manage Programs on the Customer’s behalf or leave them self-managed depending on the Order Form. If AntCrowd objects to any Program or Policy,
            it will notify the Customer, describe objections, and work together to resolve them. AntCrowd may pause or disable Programs that have been inactive without Customer response
            within ten (10) business days after written notice.
          </p>
          <p>The Customer is solely responsible for preparing, owning, and ensuring compliance of Program Materials with applicable Program Policies and the Vulnerability Disclosure Guidelines.</p>
        </section>

        <section className="terms-section">
          <h2>7. Intellectual Property</h2>
          <p>AntCrowd owns the AntCrowd Property, while the Customer retains rights to its Program Materials and Community Member Submissions.</p>
          <p>
            The Customer grants AntCrowd a non-exclusive, worldwide, royalty-free license to use Customer Data for providing and improving the Services. AntCrowd grants the Customer
            reciprocal licenses to access AntCrowd Property and Community Member Submissions solely to use the Services as permitted.
          </p>
          <p>Customer Reports remain the property of the Customer, with a perpetual AntCrowd sublicense to any AntCrowd Property included in those reports.</p>
        </section>

        <section className="terms-section">
          <h2>8. Confidentiality</h2>
          <p>The General Terms set forth each party’s obligations regarding Confidential Information. Please consult the General Terms for the full confidentiality framework.</p>
        </section>

        <section className="terms-section">
          <h2>9. Warranty</h2>
          <p>
            Except for Services related to AI/ML Output generation, AntCrowd warrants that the Services will be performed as described in an Order Form or written agreement,
            by qualified personnel, and in accordance with available documentation.
          </p>
          <p>
            To make a warranty claim, the Customer must provide written notice within thirty (30) days describing the non-compliance. AntCrowd’s sole remedy is to promptly re-perform
            or otherwise cure the Services at its expense within thirty (30) days of that notice.
          </p>
          <p>Except as stated above, AntCrowd disclaims all other warranties, express or implied, including merchantability, fitness for purpose, or non-infringement.</p>
          <p>The Services are “commercial” offerings under FAR 2.101 and DFARS 227.704(a)(1).</p>
          <p>Customers must comply with applicable export controls and economic sanctions, and AntCrowd may immediately terminate access if it reasonably believes such laws are violated.</p>
        </section>

        <section className="terms-section">
          <h2>10. Indemnification</h2>
          <p>
            The Customer indemnifies, defends, and holds AntCrowd and its officers harmless for claims stemming from Customer Data infringing third-party rights,
            misuse of Community Member Submissions, or actions taken under the Customer’s instructions.
          </p>
          <p>
            AntCrowd will indemnify the Customer for third-party claims that the AntCrowd Platform infringes intellectual property rights, excluding claims relating to Customer Data,
            Community Member Submissions, or Outputs generated by the Customer.
          </p>
          <p>
            Indemnified parties must promptly notify the other party, cooperate in the defense, and allow the indemnifying party to control the defense while retaining the right to
            participate at their own expense.
          </p>
        </section>

        <section className="terms-section">
          <p>Please see the prior Customer Terms and Conditions for Order Forms entered before July 20, 2024.</p>
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
