// Page: Partners
const partnerCards = [
  {
    title: 'Resellers / solutions providers',
    body:
      'Enhance your security portfolio and help customers scale coverage. Offer bug bounty, pentest, disclosure, AI red teaming, and security training through AntCrowd.'
  },
  {
    title: 'Consultants — Referral Partners',
    body:
      'Recommend AntCrowd to clients who need a trusted security partner. We make it simple to connect your clients with the right testing and assurance programs.'
  },
  {
    title: 'Distributors',
    body:
      'Build a diverse portfolio of cybersecurity solutions for your channel. Access enablement resources and partner support to help you grow.'
  },
  {
    title: 'Technology partners',
    body:
      'Integrate AntCrowd into your platform to deliver continuous vulnerability discovery and security insights. Build joint workflows for modern security teams.'
  }
];

export default function Partners() {
  // Page layout.
  return (
    <main className="partners-page">
      <section className="partners-hero">
        <div className="partners-hero-inner">
          <span className="partners-eyebrow">Build a safer internet, together</span>
          <h1>AntCrowd Partners</h1>
          <div className="partners-hero-actions">
            <button type="button" className="partners-hero-primary">
              Partner with AntCrowd
            </button>
            <button type="button" className="partners-hero-secondary">
              Find a Channel Partner
            </button>
          </div>
        </div>
        <div className="partners-hero-art" aria-hidden="true">
          <div className="partners-hero-ring" />
          <div className="partners-hero-slab" />
        </div>
      </section>

      <section className="partners-section">
        <div className="partners-container">
          <h2>We believe the strongest security comes from collaboration.</h2>
          <p>
            That&apos;s why we offer the PartnerOne Program, designed to empower businesses like yours to contribute to a
            safer online world.
          </p>
          <p>
            The PartnerOne Program offers a variety of opportunities, whether you&apos;re a reseller expanding your
            portfolio or a solution provider seeking seamless integration.
          </p>
        </div>
      </section>

      <section className="partners-band">
        <div className="partners-band-inner">
          <span className="partners-band-logo">antcrowd</span>
          <button type="button" className="partners-band-cta">
            Get Started
          </button>
        </div>
      </section>

      <section className="partners-section partners-grid-section">
        <div className="partners-container">
          <div className="partners-grid">
            {partnerCards.map((card) => (
              <article className="partners-card" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="partners-section partners-cta-section">
        <div className="partners-container">
          <div className="partners-cta-card">
            <div className="partners-cta-content">
              <h3>Become an AntCrowd Partner</h3>
              <button type="button" className="partners-cta-link">
                Become an AntCrowd Partner
              </button>
            </div>
            <div className="partners-cta-art" aria-hidden="true" />
          </div>
        </div>
      </section>
    </main>
  );
}
