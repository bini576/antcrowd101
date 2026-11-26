import { type FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getDemoRequestNetworkErrorMessage, submitDemoRequest } from '../services/demoRequestApi';
// Page: RequestDemo

const businessPoints = [
  'Map the right security service mix for your current maturity and risk profile',
  'Review how AntCrowd connects pentest, VDP, and training in one platform experience',
  'Plan a realistic rollout for onboarding, approvals, and service operations'
];

const supportOptions = [
  'Bug Bounty',
  'Pentest as a Service',
  'VDP',
  'Challenge',
  'Trust Center',
  'Training',
  'AI Red Teaming',
  'Code'
];

const trustedLogos = ['BANKING', 'FINTECH', 'HEALTHCARE', 'SAAS', 'PUBLIC SECTOR', 'ENTERPRISE'];

export default function RequestDemo() {
  // Page layout.
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showWorkEmailMessage = useMemo(() => /@gmail\.com$/i.test(email.trim()), [email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedOnce(true);
    const form = event.currentTarget;

    const supportInputs = Array.from(form.querySelectorAll<HTMLInputElement>("input[name='support']"));
    const hasSupportSelection = supportInputs.some((input) => input.checked);
    if (supportInputs.length > 0) {
      supportInputs[0].setCustomValidity(hasSupportSelection ? '' : 'This field is required');
    }

    if (!form.checkValidity()) {
      setSubmitError('Please fill all required fields.');
      form.reportValidity();
      return;
    }
    setSubmitError('');

    const formData = new FormData(form);
    const payload = {
      email: String(formData.get('email') ?? email).trim(),
      firstName: String(formData.get('firstName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      company: String(formData.get('company') ?? '').trim(),
      title: String(formData.get('title') ?? '').trim(),
      headcount: String(formData.get('headcount') ?? '').trim(),
      country: String(formData.get('country') ?? '').trim(),
      support: formData.getAll('support').map((entry) => String(entry)),
      frameworks: String(formData.get('frameworks') ?? '').trim(),
      hearAbout: String(formData.get('hearAbout') ?? '').trim(),
      partner: formData.get('partner') === 'yes'
    };

    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      await submitDemoRequest({
        email: payload.email,
        headcount: payload.headcount,
        country: payload.country.replace(/\s+/g, '').toLowerCase(),
        hearAbout: payload.hearAbout
      });
      setSubmitSuccess(true);
      form.reset();
      setEmail('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : getDemoRequestNetworkErrorMessage());
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleInvalid(event: FormEvent<HTMLFormElement>) {
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    if (field.validity.valueMissing) {
      field.setCustomValidity('This field is required');
    } else {
      field.setCustomValidity('');
    }
  }

  function handleInput(event: FormEvent<HTMLFormElement>) {
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    if (typeof field.setCustomValidity === 'function') {
      field.setCustomValidity('');
    }
    if (field instanceof HTMLInputElement && field.name === 'support') {
      const form = field.form;
      if (!form) {
        return;
      }
      const supportInputs = Array.from(form.querySelectorAll<HTMLInputElement>("input[name='support']"));
      const hasSupportSelection = supportInputs.some((input) => input.checked);
      if (supportInputs.length > 0) {
        supportInputs[0].setCustomValidity(hasSupportSelection ? '' : 'This field is required');
      }
    }
  }

  return (
    <main className="demo-page">
      {/* Content section. */}
      <section className="demo-stage">
        {/* Form block. */}
        <form
          className={`demo-request-form ${submittedOnce ? 'submitted' : ''}`}
          onSubmit={handleSubmit}
          onInvalid={handleInvalid}
          onInput={handleInput}
        >
          {/* Content section. */}
          <section className="demo-grid demo-grid-top">
            <article className="demo-left">
              <h2>Find out what AntCrowd can do for your business.</h2>

              <h3>Meet one-on-one with an AntCrowd expert to:</h3>
              {/* List block. */}
              <ul className="demo-points">
                {businessPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>

              <p className="demo-rating">Advisor-ready walkthroughs focused on real onboarding, access, and service operations.</p>
            </article>

            {/* Content section. */}
            <section className="demo-right" aria-label="Request demo form">
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Work email*"
                required
              />

              {showWorkEmailMessage && (
                <p className="demo-error">
                  Please enter a different email address. This form does not accept addresses from gmail.com.
                </p>
              )}

              <div className="demo-two-col">
                <input type="text" name="firstName" placeholder="First name*" required />
                <input type="text" name="lastName" placeholder="Last name*" required />
              </div>

              <div className="demo-two-col">
                <input type="text" name="company" placeholder="Company name*" required />
                <input type="text" name="title" placeholder="Job title*" required />
              </div>

              <label>
                Company headcount*
                <select name="headcount" required defaultValue="">
                  <option value="" disabled>
                    Please select
                  </option>
                  <option value="1-50">1-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-1000">201-1000</option>
                  <option value="1000+">1000+</option>
                </select>
              </label>

              <label>
                Country*
                <select name="country" required defaultValue="">
                  <option value="" disabled>
                    Please select
                  </option>
                  <option value="ethiopia">Ethiopia</option>
                  <option value="addisababa">Addis Ababa</option>
                  <option value="kenya">Kenya</option>
                  <option value="bahirdar">Bahir Dar</option>
                </select>
              </label>

              <fieldset className="demo-fieldset">
                <legend>How can AntCrowd support your business?*</legend>
                {/* Grid layout. */}
                <div className="demo-check-grid">
                  {supportOptions.map((option) => (
                    <label key={option} className="demo-support-option">
                      <input type="checkbox" name="support" value={option} required={option === supportOptions[0]} />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          </section>

          {/* Content section. */}
          <section className="demo-grid demo-grid-bottom">
            <div className="demo-left-empty" aria-hidden="true" />

            {/* Content section. */}
            <section className="demo-right" aria-label="Request demo continuation">
              <label>
                Which framework(s) are you interested in?*
                <input type="text" name="frameworks" placeholder="(E.G. CMMC, FedRAMP, NIST)" required />
              </label>

              <label>
                How did you hear about us?
                <select name="hearAbout" required defaultValue="">
                  <option value="" disabled>
                    Please select
                  </option>
                  <option value="Google Search">Google Search</option>
                  <option value="Referral">Referral</option>
                  <option value="Conference">Conference or event</option>
                  <option value="AI Assistant">AI assistant</option>
                  <option value="Social Media">Social media</option>
                  <option value="Partner">Partner recommendation</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="demo-inline-check">
                <input type="checkbox" name="partner" value="yes" />
                I&apos;m an MSP/MSSP interested in partnering with AntCrowd.
              </label>

              <p className="demo-policy">
                By submitting, I agree to <Link to="/privacy-policy">AntCrowd&apos;s Privacy Policy</Link>.
              </p>
              {submitSuccess && !submitError && (
                <p className="demo-submit-success" role="status" aria-live="polite">
                  Thanks. Your request has been sent to the AntCrowd intake queue for real follow-up.
                </p>
              )}
              {submitError && (
                <p className="demo-submit-error" role="alert" aria-live="polite">
                  {submitError}
                </p>
              )}

              <button disabled={isSubmitting} type="submit">{isSubmitting ? 'Sending request...' : 'Request Demo'}</button>
            </section>
          </section>
        </form>
      </section>

      {/* Content section. */}
      <section className="demo-trusted">
        <p>Structured security programs designed for serious organizations and presentation-ready operations.</p>
        {/* Trusted by strip. */}
        <div className="demo-trusted-marquee" aria-label="Trusted logos">
          {/* Trusted by strip. */}
          <div className="demo-trusted-track">
            {[...trustedLogos, ...trustedLogos].map((logo, index) => (
              <span key={`${logo}-${index}`}>{logo}</span>
            ))}
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
              </div>
              <a href="#">Red Team as a Service</a>
              <a href="#">Bug Bounty</a>
            </div>

            <div className="ant-bug-col">
              <h4>Use cases</h4>
              <a href="#">AI Safety &amp; Security</a>
            </div>

            <div className="ant-bug-col">
              <h4>Industries</h4>
              <a href="#">Financial Services</a>
              <a href="#">Healthcare</a>
            </div>

            <div className="ant-bug-col">
              <h4>Why Antcrowd</h4>
              <a href="#">Why Crowdsourcing is Better</a>
            </div>

            <div className="ant-bug-col">
              <h4>Company</h4>
              <a href="#">Careers</a>
            </div>

            <div className="ant-bug-col ant-bug-col-right">
              <div className="ant-bug-hackers">
                <h4>For Hackers</h4>
                <a href="#">Programs</a>
                <a href="#">Leaderboard</a>
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
                Get a Demo
              </button>
            </div>
          </div>
        </div>

          <div className="ant-container ant-bug-legal">
            <span>Copyright &copy;2026 AntCrowd</span>
            <div>
              <a href="/trust">Security&Trust</a>
              <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
              <Link to="/privacy-policy">Privacy Policy</Link>
              <a href="#">Do Not Sell or Share My Information</a>
              <a href="#">General Data Protection Regulation</a>
            </div>
          </div>
      </section>
    </main>
  );
}
