import { useState } from 'react';
import { Link } from 'react-router-dom';
// Page: ContactCode

const bulletPoints = [
  'Stay ahead of compliance mandates',
  'Access a vetted pentester community',
  'Faster remediation with built-in integrations'
];

export default function ContactCode() {
  // Page layout.
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function isBusinessEmail(address: string) {
    const atIndex = address.lastIndexOf('@');
    if (atIndex === -1) return false;
    const domain = address.slice(atIndex + 1).toLowerCase();
    const blockedDomains = new Set([
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'aol.com',
      'icloud.com',
      'proton.me',
      'protonmail.com',
      'zoho.com'
    ]);
    return domain.length > 0 && !blockedDomains.has(domain);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      setSubmitError('Please complete all required fields.');
      form.reportValidity();
      return;
    }

    const emailValue = String(new FormData(form).get('email') ?? '').trim();
    if (!isBusinessEmail(emailValue)) {
      setSubmitError('Please use a business email address (e.g. name@company.com).');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    const formData = new FormData(form);
    const payload = {
      firstName: String(formData.get('firstName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      company: String(formData.get('company') ?? '').trim(),
      jobTitle: String(formData.get('jobTitle') ?? '').trim(),
      reason: String(formData.get('reason') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      country: String(formData.get('country') ?? '').trim()
    };

    const apiBase = (import.meta.env.VITE_CODE_SERVICE_URL ?? '/api/code').trim().replace(/\/$/, '');

    try {
      const response = await fetch(`${apiBase}/contact/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      setSubmitted(true);
      form.reset();
    } catch (error) {
      setSubmitError('We could not send your request to AntCrowd\'s internal sales and support system right now. Please try again shortly.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="contact-code-page">
      {/* Content section. */}
      <section className="contact-code-hero">
        {/* Hero block. */}
        <div className="contact-code-hero-inner">
          <div className="contact-code-copy">
            {/* Kicker text. */}
            <span className="contact-code-kicker">Get in touch</span>
            <h1>
              Run pentests
              <br />
              faster with
              <br />
              PTaaS
            </h1>
            {/* Subtitle block. */}
            <p className="contact-code-subtitle">
              Manage and scale your pentesting program with proven security expertise
            </p>
            {/* Feature list. */}
            <ul className="contact-code-list">
              {bulletPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          {/* Form block. */}
          <form className="contact-code-form" onSubmit={handleSubmit}>
            {/* Form block. */}
            <p className="contact-code-form-title">Our team typically responds within 1 business day</p>
            {/* Grid layout. */}
            <div className="contact-code-grid">
              <label>
                First Name*
                <input type="text" name="firstName" required />
              </label>
              <label>
                Last Name*
                <input type="text" name="lastName" required />
              </label>
              <label>
                Business Email*
                <input type="email" name="email" placeholder="name@company.com" required />
              </label>
              <label>
                Company*
                <input type="text" name="company" required />
              </label>
              <label>
                Job Title*
                <input type="text" name="jobTitle" required />
              </label>
              <label>
                Reason for Contact:*
                <select name="reason" required defaultValue="">
                  <option value="" disabled>
                    Select...
                  </option>
                  <option value="demo">Get started</option>
                  <option value="sales">Speak with sales</option>
                  <option value="partnerships">Partnerships</option>
                </select>
              </label>
              <label>
                Phone (Optional)
                <input type="tel" name="phone" />
              </label>
              <label>
                Country(location):*
                <select name="country" required defaultValue="">
                  <option value="" disabled>
                    Select...
                  </option>
                  <option value="us">Addis abeba</option>
                  <option value="uk">kenya</option>
                  <option value="ca">Bahirdar</option>
                  <option value="et">Ethiopia</option>
                </select>
              </label>
            </div>
            <p className="contact-code-disclaimer">
              We will handle your contact details in line with our <Link to="/privacy-policy">Privacy Policy</Link>. If you prefer not to receive
              marketing emails from us, you can opt-out of all marketing communications or customize your preferences
              here.
            </p>
            {submitted && !submitError && (
              <p className="contact-code-success" role="status" aria-live="polite">
Thanks. Your request is now with AntCrowd's internal sales and support team. It will not appear in your organization admin panel. Our team reviews it, responds, prepares the organization workspace, and then sends invitation links to your customer users.
              </p>
            )}
            {submitError && (
              <p className="contact-code-error" role="alert" aria-live="polite">
                {submitError}
              </p>
            )}
            <button type="submit" className="contact-code-submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
