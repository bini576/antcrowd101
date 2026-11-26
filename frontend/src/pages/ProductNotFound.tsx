import { Link } from 'react-router-dom';
// Page: ProductNotFound

export default function ProductNotFound() {
  // Page layout.
  return (
    <main className="product-notfound">
      {/* Content section. */}
      <section className="product-notfound-hero">
        <div className="product-notfound-orb" aria-hidden="true" />
        <div className="product-notfound-topbar">
          <div className="ant-container product-notfound-topbar-inner">
            <span>Hai Agentic — Smarter AI for Faster Risk Reduction</span>
            <div className="product-notfound-topbar-links">
              <Link to="/login">Login</Link>
              <a href="#">Leaderboard</a>
              <a href="#">Contacted by a hacker?</a>
            </div>
          </div>
        </div>
        {/* Header section. */}
        <header className="product-notfound-nav">
          {/* Navigation block. */}
          <div className="ant-container product-notfound-nav-inner">
            {/* Logo area. */}
            <div className="product-notfound-logo">AntCrowd</div>
            {/* Navigation section. */}
            <nav className="product-notfound-links" aria-label="Primary">
              <a href="#">Platform</a>
              <a href="#">Solutions</a>
              <a href="#">Partners</a>
              <a href="#">Researchers</a>
              <a href="#">Resources</a>
              <a href="#">Company</a>
            </nav>
            {/* Navigation block. */}
            <div className="product-notfound-nav-actions">
              <a href="#">Get Started</a>
            </div>
          </div>
        </header>
        <div className="ant-container product-notfound-inner">
          {/* Kicker text. */}
          <p className="product-notfound-kicker">Oh no!</p>
          <h1 className="product-notfound-title">Page Not Found</h1>
          <p className="product-notfound-text">
            We&apos;re sorry. The page you are looking for has either been moved or is no longer available.
          </p>
          {/* Call-to-action area. */}
          <div className="product-notfound-actions">
            {/* Call-to-action area. */}
            <Link to="/request-demo" className="product-notfound-cta">
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      {/* Content section. */}
      <section className="product-notfound-news">
        <div className="ant-container">
          <h2>What&apos;s new at AntCrowd</h2>
          {/* Cards block. */}
          <div className="product-notfound-cards">
            {/* Card block. */}
            <article className="product-notfound-card card-one">
              <p>Securing the Future of AI</p>
              <span>Guide</span>
            </article>
            {/* Card block. */}
            <article className="product-notfound-card card-two">
              <p>AntCrowd x AWS x Anthropic</p>
              <span>Partnerships</span>
            </article>
            {/* Card block. */}
            <article className="product-notfound-card card-three">
              <p>When ROI Falls Short: Return on Mitigation</p>
              <span>Report</span>
            </article>
          </div>
        </div>
      </section>

      {/* Content section. */}
      <section className="ant-bug-footer-wrap">
        {/* Footer block. */}
        <div className="ant-container ant-bug-footer-shell">
          {/* Grid layout. */}
          <div className="ant-bug-footer-grid">
            <div className="ant-bug-col">
              <h4>Products</h4>
              <a href="#">Penetration Testing</a>
              <div className="ant-bug-nested">
                <a href="#">Pen Test as a Service</a>
                <a href="#">Continuous Attack Surface Pen Testing</a>
                <a href="#">Web Application Pen Test</a>
                <a href="#">Mobile App Pen Test</a>
                <a href="#">Network Pen Test</a>
                <a href="#">API Pen Test</a>
              </div>
              <a href="#">Red Team as a Service</a>
              <a href="#">Bug Bounty</a>
            </div>

            <div className="ant-bug-col">
              <h4>Use cases</h4>
              <a href="#">AI Safety &amp; Security</a>
              <a href="#">Application and Cloud Security</a>
              <a href="#">Vulnerability Intake</a>
              <a href="#">IoT and Web3</a>
              <a href="#">Marketplace Apps</a>
            </div>

            <div className="ant-bug-col">
              <h4>Industries</h4>
              <a href="#">Financial Services</a>
              <a href="#">Healthcare</a>
              <a href="#">Retail</a>
              <a href="#">Automotive</a>
              <a href="#">Technology</a>
            </div>

            <div className="ant-bug-col">
              <h4>Why Antcrowd</h4>
              <a href="#">Why Crowdsourcing is Better</a>
              <a href="#">The Antcrowd Difference</a>
              <a href="#">Our Customers</a>
            </div>

            <div className="ant-bug-col">
              <h4>Company</h4>
              <a href="#">Careers</a>
              <a href="#">Leadership</a>
              <a href="#">Partners</a>
              <a href="#">Press Releases</a>
              <a href="#">Contact Us</a>
            </div>

            <div className="ant-bug-col ant-bug-col-right">
              <div className="ant-bug-hackers">
                <h4>For Hackers</h4>
                <a href="#">Programs</a>
                <a href="#">CrowdStream</a>
                <a href="#">Bug Bounty List</a>
                <a href="#">Start Hacking</a>
                <a href="#">FAQs</a>
                <a href="#">Hacker Docs</a>
                <a href="#">Leaderboard</a>
              </div>
              {/* Social links. */}
              <div className="ant-bug-social">
                <span>in</span>
                <span>X</span>
                <span>ig</span>
                <span>gh</span>
                <span>yt</span>
              </div>
            </div>
          </div>

          {/* Footer block. */}
          <div className="ant-bug-footer-bottom">
            <div className="ant-bug-brand">AntCrowd</div>
            {/* Call-to-action area. */}
            <div className="ant-bug-footer-actions">
              <button type="button">Contact</button>
              <button type="button" className="accent">
                Get Started
              </button>
            </div>
          </div>
        </div>

        <div className="ant-container ant-bug-legal">
          <span>Copyright &copy;2026 AntCrowd</span>
          <div>
            <a href="#">Security</a>
            <a href="/trust">Trust</a>
            <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <a href="#">Do Not Sell or Share My Information</a>
          </div>
        </div>
      </section>
    </main>
  );
}
