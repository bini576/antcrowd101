import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  getOrgId,
  hasTrustApiConfig,
  submitAccessRequest,
  submitSubscription,
} from "../../lib/trustApi";

type RequestReceipt = {
  requester: string;
  email: string;
  reason: string;
  resource: string;
  accessLevel: string;
};

type RequestFieldErrors = {
  firstName?: string;
  lastName?: string;
  requestEmail?: string;
  companyName?: string;
  requestReason?: string;
  resourceLevel?: string;
};

export default function Navbar() {
  const [activeModal, setActiveModal] = useState<"subscribe" | "request" | "requestSent" | null>(
    null
  );
  const [requestStatus, setRequestStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [requestErrorText, setRequestErrorText] = useState("Request failed. Try again.");
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle"
  );
  const [subscribeErrorText, setSubscribeErrorText] = useState("Subscription failed. Try again.");
  const [requestReceipt, setRequestReceipt] = useState<RequestReceipt | null>(null);
  const [requestErrors, setRequestErrors] = useState<RequestFieldErrors>({});

  const handleSubscribeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubscribeStatus("submitting");
    setSubscribeErrorText("Subscription failed.Try again.");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const email = String(formData.get("subscribeEmail") ?? "").trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setSubscribeErrorText("Enter a valid email");
        setSubscribeStatus("error");
        return;
      }

      if (!hasTrustApiConfig()) {
        throw new Error("Frontend API env is missing");
      }

      await submitSubscription(getOrgId(), { email });
      setSubscribeStatus("success");
      form.reset();
    } catch (error) {
      if (error instanceof Error && error.message === "Frontend API env is missing") {
        setSubscribeErrorText("Backend is not configured. Set VITE_API_BASE_URL and VITE_ORG_ID.");
      } else {
        setSubscribeErrorText("Subscription failed. Try again.");
      }
      if (error instanceof Error) console.error("Subscribe failed:", error.message);
      setSubscribeStatus("error");
    }
  };

  const stripDisallowedCharacters = (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    input.value = input.value.replace(/[.,]/g, "");
  };

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestStatus("submitting");
    setRequestErrorText("Request failed. Try again.");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const firstName = String(formData.get("firstName") ?? "").trim();
      const lastName = String(formData.get("lastName") ?? "").trim();
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      const email = String(formData.get("requestEmail") ?? "").trim();
      const companyName = String(formData.get("companyName") ?? "").trim();
      const reason = String(formData.get("requestReason") ?? "Other").trim();
      const accessLevel = String(formData.get("accessLevel") ?? "Limited access").trim();
      const resource = String(formData.get("resourceLevel") ?? "").trim();
      const errors: RequestFieldErrors = {};
      const namePattern = /^[A-Za-z]{3,}$/;

      if (!firstName) {
        errors.firstName = "First name is required";
      } else if (!namePattern.test(firstName)) {
        errors.firstName = "Use at least 3 letters!";
      }
      if (!lastName) {
        errors.lastName = "Last name is required";
      } else if (!namePattern.test(lastName)) {
        errors.lastName = "Use at least 3 letters!";
      }
      if (!email) {
        errors.requestEmail = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.requestEmail = "Enter a valid email";
      }
      if (!companyName) errors.companyName = "Company name is required";
      if (!reason) errors.requestReason = "Please select a reason";
      if (!resource) errors.resourceLevel = "Please select resources";

      if (Object.keys(errors).length > 0) {
        setRequestErrors(errors);
        setRequestStatus("idle");
        return;
      }

      setRequestErrors({});

      if (!hasTrustApiConfig()) {
        throw new Error("Frontend API env is missing");
      }

      await submitAccessRequest(getOrgId(), {
        full_name: fullName,
        email,
        company_name: companyName,
        reason: `${reason}; access=${accessLevel}; resource=${resource}`,
      });

      setRequestStatus("idle");
      setRequestReceipt({
        requester: fullName,
        email,
        reason,
        resource,
        accessLevel,
      });
      setActiveModal("requestSent");
    } catch (error) {
      if (error instanceof Error && error.message === "Frontend API env is missing") {
        setRequestErrorText("Backend is not configured. Set VITE_API_BASE_URL and VITE_ORG_ID.");
      }
      setRequestStatus("error");
    }
  };

  const handleRequestFieldChange = (field: keyof RequestFieldErrors) => {
    if (!requestErrors[field]) return;
    setRequestErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <header className="site-header">
      <div className="site-topbar">
        <Link to="/trust" className="brand-block" aria-label="Trust Center home">
          <span className="brand-logo">
            <img
              src="/assets/AntCrowd_logo.jpg"
              alt="Antcrowd logo"
              className="brand-logo-image"
              loading="lazy"
            />
          </span>
          <span className="brand-divider" />
          <span className="brand-title">Trust&nbsp;Center</span>
        </Link>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setSubscribeStatus("idle");
              setSubscribeErrorText("Subscription failed. Try again.");
              setActiveModal("subscribe");
            }}
            aria-expanded={activeModal === "subscribe"}
            aria-controls="subscribe-form"
          >
            Subscribe to updates
            <span className="notify-icon" aria-hidden="true">
              🔔
            </span>
          </button>
          <button className="btn btn-ghost" type="button">
            Ask a question
          </button>
          <button
            className="btn btn-primary request-access-btn"
            type="button"
            onClick={() => {
              setRequestStatus("idle");
              setRequestErrors({});
              setActiveModal("request");
            }}
            aria-expanded={activeModal === "request"}
            aria-controls="request-form"
          >
            Request access
          </button>
        </div>
      </div>
      {activeModal ? (
        <div className="topbar-modal-overlay" onClick={() => setActiveModal(null)}>
          <div
            className={`topbar-modal-card ${
              activeModal === "subscribe"
                ? "topbar-modal-card-subscribe"
                : activeModal === "request"
                  ? "topbar-modal-card-request"
                  : "topbar-modal-card-request-sent"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setActiveModal(null)}
              aria-label="Close form"
            >
              ×
            </button>
            {activeModal === "subscribe" ? (
              <form
                id="subscribe-form"
                className="topbar-inline-form"
                onSubmit={handleSubscribeSubmit}
              >
                <h3>Subscribe to updates</h3>
                <p className="modal-help-text">
                  Receive email notifications when AntCrowd publishes updates to their Trust
                  Center.
                </p>
                <label htmlFor="subscribe-email" className="modal-field-label">
                  Email
                </label>
                <input
                  id="subscribe-email"
                  type="email"
                  name="subscribeEmail"
                  placeholder="email@company.com"
                  autoComplete="email"
                  required
                />
                {subscribeStatus === "success" ? (
                  <p className="request-status success">Subscribed successfully.</p>
                ) : null}
                {subscribeStatus === "error" ? (
                  <p className="request-status error">{subscribeErrorText}</p>
                ) : null}
                <p className="modal-policy-text">
                  By signing up for email notifications you agree to the{" "}
                  <Link to="/privacy-policy" aria-label="Privacy policy">
                    privacy policy
                  </Link>
                  .
                </p>
                <div className="modal-action-row">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit">
                    Subscribe
                  </button>
                </div>
              </form>
            ) : activeModal === "request" ? (
              <form
                id="request-form"
                className="topbar-request-form"
                onSubmit={handleRequestSubmit}
                noValidate
              >
                <h3>Request access</h3>
                <p className="request-reclaim-text">
                  Already have access?{" "}
                  <a href="#" aria-label="Reclaim access">
                    Reclaim access
                  </a>
                </p>
                <label htmlFor="request-first-name" className="modal-field-label">
                  First name
                </label>
                <input
                  id="request-first-name"
                  type="text"
                  name="firstName"
                  minLength={3}
                  pattern="[A-Za-z]{3,}"
                  title="Use at least 3 letters"
                  className={requestErrors.firstName ? "field-invalid" : ""}
                  onInput={stripDisallowedCharacters}
                  onChange={() => handleRequestFieldChange("firstName")}
                  required
                />
                {requestErrors.firstName ? (
                  <p className="field-error">{requestErrors.firstName}</p>
                ) : null}
                <label htmlFor="request-last-name" className="modal-field-label">
                  Last name
                </label>
                <input
                  id="request-last-name"
                  type="text"
                  name="lastName"
                  minLength={3}
                  pattern="[A-Za-z]{3,}"
                  title="Use at least 3 letters"
                  className={requestErrors.lastName ? "field-invalid" : ""}
                  onInput={stripDisallowedCharacters}
                  onChange={() => handleRequestFieldChange("lastName")}
                  required
                />
                {requestErrors.lastName ? <p className="field-error">{requestErrors.lastName}</p> : null}
                <label htmlFor="request-email" className="modal-field-label">
                  Email
                </label>
                <input
                  id="request-email"
                  type="email"
                  name="requestEmail"
                  className={requestErrors.requestEmail ? "field-invalid" : ""}
                  onChange={() => handleRequestFieldChange("requestEmail")}
                  autoComplete="email"
                  required
                />
                {requestErrors.requestEmail ? (
                  <p className="field-error">{requestErrors.requestEmail}</p>
                ) : null}
                <label htmlFor="request-company" className="modal-field-label">
                  Company name
                </label>
                <input
                  id="request-company"
                  type="text"
                  name="companyName"
                  className={requestErrors.companyName ? "field-invalid" : ""}
                  onChange={() => handleRequestFieldChange("companyName")}
                  required
                />
                {requestErrors.companyName ? (
                  <p className="field-error">{requestErrors.companyName}</p>
                ) : null}
                <label htmlFor="request-reason" className="modal-field-label">
                  Reason
                </label>
                <select
                  id="request-reason"
                  name="requestReason"
                  defaultValue=""
                  className={requestErrors.requestReason ? "field-invalid" : ""}
                  onChange={() => handleRequestFieldChange("requestReason")}
                  required
                >
                  <option value="" disabled>
                    Select a reason
                  </option>
                  <option value="I'm an existing customer">I'm an existing customer</option>
                  <option value="I'm a prospective customer">I'm a prospective customer</option>
                  <option value="Other">Other</option>
                </select>
                {requestErrors.requestReason ? (
                  <p className="field-error">{requestErrors.requestReason}</p>
                ) : null}
                <div className="resource-block">
                  <h4>Resources</h4>
                  <div className="resource-label-row">
                    <label className="modal-field-label resource-label">Access level</label>
                    <span className="resource-tip-wrap" tabIndex={0} aria-label="Access level info">
                      ⓘ
                      <span className="resource-tip-text">
                        Request full access to gain access to all public and requestable
                        resources. Request limited access to gain access to resources you select
                        individually.
                      </span>
                    </span>
                  </div>
                  <div className="access-level-options">
                    <label>
                      <input type="radio" name="accessLevel" value="Full access" />
                      Full access
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="accessLevel"
                        value="Limited access"
                        defaultChecked
                      />
                      Limited access
                    </label>
                  </div>
                  <select
                    id="request-resource-level"
                    name="resourceLevel"
                    defaultValue=""
                    className={requestErrors.resourceLevel ? "field-invalid" : ""}
                    onChange={() => handleRequestFieldChange("resourceLevel")}
                    required
                  >
                    <option value="" disabled>
                      Select resources
                    </option>
                    <option value="AntCrowd SOC 2 Type 2"> AntCrowd SOC 2 Type 2</option>
                    <option value="Antcrowd ISO 27001">AntCrowd ISO 27001</option>
                    <option value="AntCrowd Security Whitepaper">Antcrowd Security Whitepaper</option>
                  </select>
                  {requestErrors.resourceLevel ? (
                    <p className="field-error">{requestErrors.resourceLevel}</p>
                  ) : null}
                </div>
                <div className="modal-action-row">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary request-submit-btn" type="submit">
                    Request access
                  </button>
                </div>
                {requestStatus === "error" ? (
                  <p className="request-status error">{requestErrorText}</p>
                ) : null}
              </form>
            ) : (
              <div className="request-sent-modal">
                <h3>Access request sent</h3>
                <p>
                  If approved, you will receive an email from Vanta{" "}
                  <a href="mailto:no-reply@vanta.com">no-reply@vanta.com</a> to access the Trust
                  Center. An NDA may be required to be signed. If required, you will need to sign
                  one before accessing the documents further.
                </p>
                <p>Vanta has received the following request:</p>
                <div className="request-summary-card">
                  <h4>Requester</h4>
                  <p>{requestReceipt?.requester}</p>
                  <p className="request-email">{requestReceipt?.email}</p>

                  <h4>Reason for request</h4>
                  <p>{requestReceipt?.reason}</p>

                  <h4>Documents requested</h4>
                  <p>
                    {requestReceipt?.accessLevel}: {requestReceipt?.resource}
                  </p>
                </div>
                <div className="modal-action-row">
                  <button className="btn btn-primary request-submit-btn" onClick={() => setActiveModal(null)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
