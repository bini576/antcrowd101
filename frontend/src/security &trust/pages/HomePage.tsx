import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ControlCard from "../components/controls/ControlCard";
import {
  fetchCompliance,
  fetchFaq,
  fetchOverviews,
  fetchSubprocessors,
  fetchUpdates,
  getOrgId,
  hasTrustApiConfig,
} from "../lib/trustApi";

const tabs = [
  { href: "overview", label: "Overview" },
  { href: "resources", label: "Resources" },
  { href: "controls", label: "Controls" },
  { href: "subprocessors", label: "Subprocessors" },
  { href: "faq", label: "FAQ" },
  { href: "updates", label: "Updates" },
];

const defaultComplianceItems = [

  "Personal Data Protection Proclamation No.1321/024", /* personal data protection equivalent to GDPR. */
  "ISO/IEC 27001",/* risk managment access control,asset inventory incident respons. */
  "ISO/IEC 27701",/* privacy framework. */
  
  "Trusted Cloud Provider (CSA)",
  "ITIL",/* IT service managment framework. */
  "antcrowd Secure Implementation Guidelines",
  "PCI-DSS ",/* payment security framework. */

];

const defaultDataCollectedItems = [
  { label: "Customer personally identifiable information", collected: true },
  { label: "Employee personally identifiable information", collected: true },
  { label: "Credit card information", collected: false },
  { label: "Personal health information", collected: false },
];

const resourceSections = [
  {
    title: "Compliance",
    items: [
      "antcrowd SOC 2 Type 2",
      "Resilience and Business Continuity at antcrowd",
    ],
    moreText: "View 4 more",
  },
  {
    title: "Penetration Testing",
    items: [
      "Penetration Test Executive Summary Report incl. retest (Feb 2026)",
      "Penetration Test Status of Findings (Feb 2026)",
    ],
  },
  {
    title: "Privacy",
    items: [
      "SaaS Platform DPIA",
      "antcrowd Transfer Impact Analysis (TIA)",
      "antcrowd's Data Processing Agreement (DPA)",
    ],
  },
];

const defaultSubprocessors = [
  { name: "Amazon Web Services", purpose: "Infrastructure hosting", location: "US" },
  { name: "postgresSQL Inc.", purpose: "Database hosting", location: "us" },
  { name: "Cloudflare", purpose: "Hosting and content delivery", location: "US" },
];

const defaultFaqs = [
  "How often is infrastructure access reviewed?",
  "Is customer data encrypted?",
  "How do you handle incidents?",
];

const defaultUpdates = [
  { id: "u1", title: "Quarterly access review completed", date: "Jan 15, 2026" },
  { id: "u2", title: "Backup retention policy expanded", date: "feb 02, 2026" },
  { id: "u3", title: "Dependency scanning improvements", date: "march 11, 2026" },
];

const controlGroups = [
  {
    title: "Infrastructure Security",
    status: "implemented",
    items: [
      "Service infrastructure maintained",
      "Production data backups conducted",
      "Database replication utilized",
    ],
    moreText: "View 3 more Infrastructure Security controls",
  },
  {
    title: "Organizational Security",
    status: "implemented",
    items: [
      "Employee background checks performed",
      "Security awareness training implemented",
      "Confidentiality Agreement acknowledged",
    ],
    moreText: "View 3 more Organizational Security controls",
  },
  {
    title: "Internal Security Procedures",
    status: "implemented",
    items: [
      "Continuity and disaster recovery plans tested",
      "Incident response plan maintained",
      "Risk assessments performed quarterly",
    ],
    moreText: "View 3 more Internal Security Procedure controls",
  },
  {
    title: "AI Security & Compliance",
    status: "implemented",
    items: [
      "AI system impact ",
      "Data governance for AI models",
      "Model monitoring controls in place",
    ],
    moreText: "View 3 more AI Security & Compliance controls",
  },
  {
    title: "Product Security",
    status: "implemented",
    items: [
    
      "Penetration testing performed",
      "Vulnerability and system monitoring procedure",
    ],
    moreText: "View 3 more Internal Security Procedure controls",
  },
  {
    title: "Data and Privacy",
    status: "implemented",
    items: [
        "Privacy policy established",
        "Data retention procedures established",
        "Privacy compliant procedures established",
    ],
    moreText: "View 3 more AI Security & Compliance controls",
  },
  
];

export default function HomePage() {
  const navigate = useNavigate();
  const [heroSummary, setHeroSummary] = useState(
    "Antcrowd is the leading agentic trust platform that helps businesses earn and prove trust. Over xxxx companies like A, B, C, D, F, and Synthesia rely on Antcrowd to earn and prove trust continuously. Founded in 2018, antcrowd serves customers in xx countries with offices in Bahirdar, , Adis ababa, hawasa, and mekelle."
  );
  const [heroContact, setHeroContact] = useState("security@antcrowd.com");
  const [complianceItems, setComplianceItems] = useState(defaultComplianceItems);
  const [subprocessors, setSubprocessors] = useState(defaultSubprocessors);
  const [faqItems, setFaqItems] = useState(defaultFaqs);
  const [updates, setUpdates] = useState(defaultUpdates);

  useEffect(() => {
    if (!hasTrustApiConfig()) return;
    const orgId = getOrgId();

    fetchOverviews()
      .then((items) => {
        if (!items.length) return;
        const latest = items[items.length - 1];
        if (latest.summary) setHeroSummary(latest.summary);
        if (latest.contact_email) setHeroContact(latest.contact_email);
      })
      .catch(() => {
        // Keep defaults on backend error.
      });

    fetchCompliance(orgId)
      .then((items) => {
        if (!items.length) return;
        setComplianceItems(items.map((item) => item.framework));
      })
      .catch(() => {
        // Keep defaults on backend error.
      });

    fetchSubprocessors(orgId)
      .then((items) => {
        if (!items.length) return;
        setSubprocessors(
          items.slice(0, 4).map((item) => ({
            name: item.name,
            purpose: item.purpose ?? "Service provider",
            location: item.location ?? "Global",
          }))
        );
      })
      .catch(() => {
        // Keep defaults on backend error.
      });

    fetchFaq(orgId)
      .then((items) => {
        if (!items.length) return;
        setFaqItems(items.slice(0, 4).map((item) => item.question));
      })
      .catch(() => {
        // Keep defaults on backend error.
      });

    fetchUpdates(orgId)
      .then((items) => {
        if (!items.length) return;
        setUpdates(
          items.slice(0, 4).map((item) => ({
            id: item.id,
            title: item.title,
            date: item.published_at
              ? new Date(item.published_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                })
              : "Recent",
          }))
        );
      })
      .catch(() => {
        // Keep defaults on backend error.
      });
  }, []);

  return (
    <div className="home-shell">
      <section className="hero-band">
        <main>
          <div className="hero-content">
            <div>
              <h1 className="hero-title">AntCrowd</h1>
              <p className="hero-text">{heroSummary}</p>
              <div className="hero-links">
                <a className="hero-link-item" href={`mailto:${heroContact}`}>
                  {heroContact}
                </a>
                <a className="hero-link-item" href="#">
                  Privacy Policy
                </a>
              </div>
            </div>
          </div>
        </main>
      </section>

      <main>
        <nav className="trust-tabs" aria-label="Trust center sections">
          {tabs.map((tab) => (
            <NavLink
              key={tab.href}
              to={tab.href}
              className={({ isActive }) => `trust-tab ${isActive ? "trust-tab-active" : ""}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <section className="home-columns">
          <div>
            <h2 className="panel-title">Compliance</h2>
            <article className="panel-card compliance-panel-card">
              <ul className="compliance-list">
                {complianceItems.map((item) => (
                  <li key={item}>
                    <span className="cert-dot" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel-card home-resources-panel">
              <div className="home-extra-head">
                <h2 className="home-extra-title">Resources</h2>
                <button type="button" className="home-view-all" onClick={() => navigate("resources")}>
                  View all
                </button>
              </div>

              <div className="home-resource-sections">
                {resourceSections.map((section) => (
                  <section key={section.title}>
                    <h3 className="home-resource-section-title">{section.title}</h3>
                    <ul className="home-resource-list">
                      {section.items.map((item) => (
                        <li key={item} className="home-resource-item">
                          <button type="button" className="home-link-item" onClick={() => navigate("resources")}>
                            {item}
                          </button>
                          <span className="home-resource-lock" aria-hidden="true">
                            🔒
                          </span>
                        </li>
                      ))}
                      {section.moreText ? (
                        <li>
                          <button type="button" className="home-link-item" onClick={() => navigate("resources")}>
                            {section.moreText}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </section>
                ))}
              </div>
            </article>
          </div>

          <div>
            <div className="controls-heading-row">
              <h2 className="panel-title">Controls</h2>
              <span className="updated-pill">Updated 4 minutes ago</span>
            </div>
            <div className="controls-grid home-controls-grid">
              {controlGroups.map((group) => (
                <ControlCard
                  key={group.title}
                  className="home-control-card"
                  title={group.title}
                  status={group.status}
                  items={group.items}
                  itemIcon={
                    <span className="home-control-check-icon" aria-hidden="true">
                      ✓
                    </span>
                  }
                  detailsLabel={group.moreText}
                  onTitleClick={() => navigate("controls")}
                  onOpenDetails={() => navigate("controls")}
                />
              ))}
            </div>
            <div className="home-right-extras">
              <article className="home-extra-card">
                <div className="home-extra-head">
                  <h2 className="home-extra-title">Data Collected</h2>
                </div>
                <ul className="home-data-list">
                  {defaultDataCollectedItems.map((item) => (
                    <li key={item.label} className="home-data-item">
                      <span className={`home-data-mark ${item.collected ? "home-data-yes" : "home-data-no"}`}>
                        {item.collected ? "✓" : "✕"}
                      </span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="home-extra-card">
                <div className="home-extra-head">
                  <h2 className="home-extra-title">Subprocessors</h2>
                </div>
                <ul className="home-sub-list">
                  {subprocessors.map((item) => (
                    <li key={item.name} className="home-sub-item">
                      <div>
                        <p className="home-sub-name">{item.name}</p>
                        <p className="home-sub-purpose">{item.purpose}</p>
                      </div>
                      <p className="home-sub-location">{item.location}</p>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="home-extra-card">
                <div className="home-extra-head">
                  <h2 className="home-extra-title">FAQ</h2>
                </div>
                <ul className="home-link-list">
                  {faqItems.map((item) => (
                    <li key={item}>
                      <button type="button" className="home-link-item" onClick={() => navigate("faq")}>
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="home-extra-card">
                <div className="home-extra-head">
                  <h2 className="home-extra-title">Updates</h2>
                </div>
                <ul className="home-update-list">
                  {updates.map((item) => (
                    <li key={item.id} className="home-update-item">
                      <p className="home-update-title">{item.title}</p>
                      <p className="home-update-date">{item.date}</p>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <footer className="home-powered-by" aria-label="Powered by">
          <p className="home-powered-label">POWERED BY:</p>
          <p className="home-powered-brand">AntCrowd</p>
        </footer>
      </main>
    </div>
  );
}
