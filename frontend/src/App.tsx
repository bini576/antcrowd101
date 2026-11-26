import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Home from './pages/Home';
import RequestDemo from './pages/RequestDemo';
import Solutions from './pages/Solutions';
import Partners from './pages/Partners';
import Researchers from './pages/Researchers';
import Leaderboard from './pages/Leaderboard';
import TrustDirectory from './pages/TrustDirectory';
import PublicTrustPage from './pages/PublicTrustPage';
import Login from './pages/Login';
import SignupChoice from './pages/SignupChoice';
import ForgotPassword from './pages/ForgotPassword';
import SignupForm from './pages/SignupForm';
import ProductNotFound from './pages/ProductNotFound';
import AboutUs from './pages/AboutUs';
import Careers from './pages/Careers';
import ContactCode from './pages/ContactCode';
import TrustApp from './security &trust/TrustApp';
import ComplianceTeamPage from './pages/ComplianceTeamPage';
import DeveloperPage from './pages/DeveloperPage';
import ResearcherLogin from './pages/ResearcherLogin';
import ResearcherSignup from './pages/ResearcherSignup';
import ResearcherConfirmEmail from './pages/ResearcherConfirmEmail';
import Researcher2FASetup from './pages/Researcher2FASetup';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import ContactUs from './pages/ContactUs';
import ContactThankYou from './pages/ContactThankYou';
import CompanyOnboarding from './pages/CompanyOnboarding';
import OrganizationDashboard from './pages/organization/OrganizationDashboard';
import CompanyInviteTeam from './pages/CompanyInviteTeam';
import CompanyInviteAccept from './pages/CompanyInviteAccept';
import OrganizationPendingApproval from './pages/OrganizationPendingApproval';
import RequireResearcherAuth from './components/RequireResearcherAuth';
import RequireOrganizationAuth from './components/RequireOrganizationAuth';
import RequireApprovedResearcher from './components/RequireApprovedResearcher';
import ResearcherVerificationPage from './pages/ResearcherVerification';
import ResearcherInviteAccept from './pages/ResearcherInviteAccept';
import {
  ResearcherDashboard,
  ResearcherInbox,
  ResearcherInvitations,
  ResearcherPayments,
  ResearcherProfile,
  ResearcherProgramDetail,
  ResearcherPrograms,
  ResearcherReportDetail,
  ResearcherReportNew,
  ResearcherReports,
  ResearcherSettings
} from './pages/researcher/ResearcherPages';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PlatformRedirect from './pages/PlatformRedirect';
import ProductServicePage, { type ProductServiceSlug } from './pages/ProductServicePage';
import FeedbackButton from './components/FeedbackButton';

type SimplePageProps = {
  title: string;
  description: string;
};

function SimplePage({ title, description }: SimplePageProps) {
  return (
    <section className="min-h-screen bg-slate-950 px-6 py-20 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-8 shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">AntCrowd</p>
        <h1 className="mt-3 font-space text-4xl font-black text-white">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">{description}</p>
      </div>
    </section>
  );
}

function AdminPortalRedirect() {
  const configured = (import.meta.env.VITE_PEN_ADMIN_PORTAL_URL ?? '/admin/').trim();
  const target = /^https?:\/\//i.test(configured)
    ? configured
    : `http://localhost:8089${configured.startsWith('/') ? configured : `/${configured}`}`;

  useEffect(() => {
    window.location.assign(target);
  }, [target]);

  return (
    <SimplePage
      title="Opening Admin Console..."
      description="If redirect does not start automatically, use http://localhost:8089/admin/."
    />
  );
}

function formatSlugTitle(slug: string) {
  return slug
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function ProductRoute() {
  const { slug } = useParams();

  const serviceSlugs: ProductServiceSlug[] = [
    'bug-bounty',
    'pentest',
    'vdp',
    'trust-center',
    'training',
    'ai-red-teaming',
    'challenge',
    'code'
  ];

  if (slug && serviceSlugs.includes(slug as ProductServiceSlug)) {
    return <ProductServicePage slug={slug as ProductServiceSlug} />;
  }

  return <ProductNotFound />;
}

function SectionRoute({
  section,
  description
}: {
  section: string;
  description: string;
}) {
  const { slug } = useParams();

  if (!slug) {
    return (
      <SimplePage
        title={section}
        description={description}
      />
    );
  }

  return (
    <SimplePage
      title={`${section}: ${formatSlugTitle(slug)}`}
      description={description}
    />
  );
}

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/product"
        element={<ProductNotFound />}
      />
      <Route path="/product/:slug" element={<ProductRoute />} />
      <Route path="/platform/:service" element={<PlatformRedirect />} />
      <Route path="/trust" element={<TrustDirectory />} />
      <Route path="/trust/:orgSlug" element={<PublicTrustPage />} />
      <Route path="/trust-center" element={<TrustDirectory />} />
      <Route path="/trust/app/*" element={<TrustApp />} />
      <Route path="/compliance" element={<ComplianceTeamPage />} />
      <Route path="/developer" element={<DeveloperPage />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/request-demo" element={<RequestDemo />} />
      <Route path="/contact/code" element={<ContactCode />} />
      <Route path="/solutions" element={<Solutions />} />
      <Route
        path="/solutions/:slug"
        element={
          <SectionRoute
            section="Solutions"
            description="Solutions tailored for startups, enterprises, and regulated industries."
          />
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/signup" element={<SignupChoice />} />
      <Route path="/users/sign_up" element={<SignupChoice />} />
      <Route path="/signup/:type" element={<SignupForm />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/partners" element={<Partners />} />
      <Route
        path="/partners/:slug"
        element={
          <SectionRoute
            section="Partners"
            description="Collaborate with AntCrowd to scale trusted security outcomes."
          />
        }
      />
      <Route path="/researchers" element={<Researchers />} />
      <Route path="/researchers/leaderboard" element={<Leaderboard />} />
      <Route
        path="/researchers/:slug"
        element={
          <SectionRoute
            section="Researchers"
            description="Join our researcher community and report verified security findings."
          />
        }
      />
      <Route path="/researchers/login" element={<ResearcherLogin />} />
      <Route path="/researchers/signup" element={<ResearcherSignup />} />
      <Route path="/researchers/invite/accept" element={<ResearcherInviteAccept />} />
      <Route path="/create-password" element={<ResearcherInviteAccept />} />
      <Route path="/researchers/confirm-email" element={<ResearcherConfirmEmail />} />
      <Route path="/researchers/2fa-setup" element={<Researcher2FASetup />} />
      <Route path="/security/2fa" element={<Researcher2FASetup />} />
      <Route
        path="/researcher/verification"
        element={
          <RequireResearcherAuth>
            <ResearcherVerificationPage />
          </RequireResearcherAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireApprovedResearcher>
            <ResearcherDashboard />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/dashboard/internal"
        element={
          <RequireApprovedResearcher>
            <ResearcherDashboard />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/dashboard/external"
        element={
          <RequireApprovedResearcher>
            <ResearcherDashboard />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/programs"
        element={
          <RequireApprovedResearcher>
            <ResearcherPrograms />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/programs/:programName"
        element={
          <RequireApprovedResearcher>
            <ResearcherProgramDetail />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireApprovedResearcher>
            <ResearcherReports />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/reports/new"
        element={
          <RequireApprovedResearcher>
            <ResearcherReportNew />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/reports/:reportId"
        element={
          <RequireApprovedResearcher>
            <ResearcherReportDetail />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/inbox"
        element={
          <RequireApprovedResearcher>
            <ResearcherInbox />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireResearcherAuth>
            <ResearcherSettings />
          </RequireResearcherAuth>
        }
      />
      <Route
        path="/payments"
        element={
          <RequireApprovedResearcher>
            <ResearcherPayments />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/invitations"
        element={
          <RequireApprovedResearcher>
            <ResearcherInvitations />
          </RequireApprovedResearcher>
        }
      />
      <Route
        path="/organization/workspace"
        element={
          <RequireOrganizationAuth>
            <OrganizationDashboard />
          </RequireOrganizationAuth>
        }
      />
      <Route
        path="/company/onboarding"
        element={
          <RequireOrganizationAuth>
            <CompanyOnboarding />
          </RequireOrganizationAuth>
        }
      />
      <Route path="/organization/pending-approval" element={<OrganizationPendingApproval />} />
      <Route
        path="/organization/invite"
        element={
          <RequireOrganizationAuth>
            <CompanyInviteTeam />
          </RequireOrganizationAuth>
        }
      />
      <Route
        path="/company/invite"
        element={
          <RequireOrganizationAuth>
            <CompanyInviteTeam />
          </RequireOrganizationAuth>
        }
      />
      <Route path="/organization/invite/accept" element={<CompanyInviteAccept />} />
      <Route path="/company/invite/accept" element={<CompanyInviteAccept />} />
      <Route path="/admin" element={<AdminPortalRedirect />} />
      <Route path="/admin/legacy" element={<Navigate to="/admin" replace />} />
      <Route
        path="/company"
        element={
          <SimplePage title="Company" description="Learn more about AntCrowd, our mission, and team." />
        }
      />
      <Route path="/company/about" element={<AboutUs />} />
      <Route path="/company/careers" element={<Careers />} />
      <Route
        path="/company/:slug"
        element={
          <SectionRoute
            section="Company"
            description="Learn more about AntCrowd, our mission, and team."
          />
        }
      />
      <Route path="/company/contact" element={<ContactUs />} />
      <Route path="/company/contact/thank-you" element={<ContactThankYou />} />
      <Route
        path="/:username"
        element={
          <RequireApprovedResearcher>
            <ResearcherProfile />
          </RequireApprovedResearcher>
        }
      />
    </Routes>
    <FeedbackButton />
    </>
  );
}
