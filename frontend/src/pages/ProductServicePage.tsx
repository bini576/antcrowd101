import { Link } from 'react-router-dom';
import { PRODUCT_GET_STARTED_URL } from '../constants/productCta';

export type ProductServiceSlug =
  | 'bug-bounty'
  | 'pentest'
  | 'vdp'
  | 'trust-center'
  | 'training'
  | 'ai-red-teaming'
  | 'challenge'
  | 'code';

type ProductFeature = {
  title: string;
  description: string;
};

type ProductServiceContent = {
  title: string;
  description: string;
  overview: string;
  features: ProductFeature[];
  ctaLabel?: string;
};

export const PRODUCT_SERVICE_CONTENT: Record<ProductServiceSlug, ProductServiceContent> = {
  'bug-bounty': {
    title: 'Bug Bounty',
    description:
      'Run continuous, researcher-powered testing programs to identify and remediate real-world vulnerabilities faster.',
    overview:
      'AntCrowd Bug Bounty helps your team maintain always-on external testing with structured triage and actionable findings.',
    features: [
      {
        title: 'Vetted Researcher Access',
        description: 'Work with trusted security researchers aligned to your scope and risk profile.'
      },
      {
        title: 'Actionable Triage Workflow',
        description: 'Prioritize validated reports with clear severity context and remediation guidance.'
      },
      {
        title: 'Program Performance Insights',
        description: 'Track submissions, response SLAs, and closure metrics from one operational view.'
      }
    ]
  },
  pentest: {
    title: 'Pentest as a Service',
    description:
      'Deliver repeatable penetration testing with faster turnaround, transparent reporting, and collaboration across teams.',
    overview:
      'AntCrowd Pentest as a Service combines expert-led testing with a platform workflow so findings move quickly from discovery to fix.',
    features: [
      {
        title: 'Scoped Assessments',
        description: 'Define targets, timelines, and test depth with clear engagement planning.'
      },
      {
        title: 'Live Finding Visibility',
        description: 'See validated issues during testing instead of waiting for only final reports.'
      },
      {
        title: 'Retest and Verification',
        description: 'Confirm remediation and close findings confidently through structured retesting.'
      }
    ]
  },
  vdp: {
    title: 'VDP',
    description:
      'Manage responsible disclosure end to end with intake, triage, communication, and closure in a single workflow.',
    overview:
      'AntCrowd VDP gives organizations a trusted channel for external vulnerability disclosure while preserving response quality and governance.',
    features: [
      {
        title: 'Centralized Intake',
        description: 'Collect disclosures through a clear policy-backed submission path.'
      },
      {
        title: 'Coordinated Response',
        description: 'Assign, track, and resolve reports with ownership and SLA visibility.'
      },
      {
        title: 'Policy and Compliance Support',
        description: 'Demonstrate mature disclosure operations with documented processes and outcomes.'
      }
    ],
    ctaLabel: 'Explore Public Programs'
  },
  'trust-center': {
    title: 'Trust Center',
    description:
      'Showcase your security posture with a customer-facing trust portal that keeps information current and accessible.',
    overview:
      'AntCrowd Trust Center helps your team share security controls, certifications, and updates in a professional, self-service experience.',
    features: [
      {
        title: 'Central Security Documentation',
        description: 'Publish security resources and evidence from one managed location.'
      },
      {
        title: 'Faster Customer Responses',
        description: 'Reduce repetitive security questionnaires with pre-published trust content.'
      },
      {
        title: 'Controlled Transparency',
        description: 'Share the right details with the right audiences through governed access.'
      }
    ],
    ctaLabel: 'Learn More'
  },
  training: {
    title: 'Training',
    description:
      'Build practical security capability across teams with focused programs aligned to modern engineering workflows.',
    overview:
      'AntCrowd Training supports security maturity with role-based learning, scenario-driven content, and measurable progress.',
    features: [
      {
        title: 'Role-Based Tracks',
        description: 'Tailor content for developers, security teams, and operational stakeholders.'
      },
      {
        title: 'Hands-On Learning',
        description: 'Reinforce key concepts through realistic labs and guided security exercises.'
      },
      {
        title: 'Progress Reporting',
        description: 'Measure completion and capability growth with clear training metrics.'
      }
    ]
  },
  'ai-red-teaming': {
    title: 'AI Red Teaming',
    description:
      'Evaluate AI systems against adversarial prompts, abuse scenarios, and policy failures before production impact.',
    overview:
      'AntCrowd AI Red Teaming helps your organization identify safety and security weaknesses in model behavior and AI-enabled workflows.',
    features: [
      {
        title: 'Adversarial Scenario Testing',
        description: 'Probe prompt injection, unsafe outputs, and jailbreak pathways with expert methodology.'
      },
      {
        title: 'Risk-Based Findings',
        description: 'Translate AI failure modes into prioritized, business-relevant risk actions.'
      },
      {
        title: 'Mitigation Validation',
        description: 'Retest controls to confirm defensive improvements before broad release.'
      }
    ]
  },
  challenge: {
    title: 'Challenge',
    description:
      'Run targeted security challenge events to pressure-test high-priority assets in a defined campaign window.',
    overview:
      'AntCrowd Challenge enables concentrated testing with curated researcher participation, fast issue validation, and clear result reporting.',
    features: [
      {
        title: 'Time-Boxed Campaigns',
        description: 'Focus testing intensity on launches, major releases, and critical milestones.'
      },
      {
        title: 'Curated Participation',
        description: 'Invite the right researchers for the technology and threat model in scope.'
      },
      {
        title: 'Outcome-Focused Reporting',
        description: 'Capture validated findings, remediation status, and campaign learnings in one view.'
      }
    ]
  },
  'code': {
    title: 'Code Security Review',
    description: 'AI code security that works like a dev and thinks like a hacker.',
    overview: 'AI is accelerating software delivery like never before. With over 80% of developers using AI to write code, businesses are shipping faster, but security risks are scaling just as quickly. Traditional tools weren\'t designed for this. Security teams need a new approach: one that\'s built for AI-generated code, adapts to modern workflows, and doesn\'t slow teams down. AntCrowd Code acts like your own AI security team, providing an ecosystem of specialized agents working alongside human experts to find, validate, and help fix vulnerabilities across your codebase.',
    features: [
      {
        title: 'Thinks like an attacker',
        description: 'Blending insights from expert security researchers with traditional SAST/SCA and advanced pattern detection, AntCrowd Code understands what real hackers target in your unique environment.'
      },
      {
        title: 'Works like a developer',
        description: 'Based on context from your codebase, frameworks, and architecture, AntCrowd Code generates fixes that are secure and aligned with your team\'s coding style.'
      },
      {
        title: 'Learns like a teammate',
        description: 'AntCrowd Code continuously adapts based on your team\'s actions and feedback. From pull request patterns to remediation decisions, it gets smarter with every interaction.'
      }
    ]
  }
};

type ProductServicePageProps = {
  slug: ProductServiceSlug;
};

export default function ProductServicePage({ slug }: ProductServicePageProps) {
  const content = PRODUCT_SERVICE_CONTENT[slug];
  const ctaHref =
    slug === 'trust-center'
      ? '/trust'
      : slug === 'vdp'
        ? '/platform/vdp-researcher'
        : PRODUCT_GET_STARTED_URL;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-red-500 to-sky-400" />
      <header className="border-b border-slate-800/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-space text-2xl font-black text-amber-400">AntCrowd</Link>
          <nav aria-label="Main" className="hidden items-center gap-5 text-sm font-semibold text-slate-300 md:flex">
            <Link to="/" className="hover:text-amber-300">Platform</Link>
            <Link to="/solutions" className="hover:text-amber-300">Solutions</Link>
            <Link to="/partners" className="hover:text-amber-300">Partners</Link>
            <Link to="/researchers" className="hover:text-amber-300">Researchers</Link>
          </nav>
          <Link to={ctaHref} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-300">
            {content.ctaLabel ?? 'Get Started'}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">{content.title}</p>
          <h1 className="mt-4 font-space text-4xl font-black tracking-tight text-white sm:text-6xl">{content.title}</h1>
          <p className="mt-6 text-base leading-8 text-slate-400">{content.description}</p>
          <Link to={ctaHref} className="mt-8 inline-flex rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300">
            {content.ctaLabel ?? 'Get Started'}
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/35">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">Key benefits</p>
          <h2 className="mt-3 max-w-3xl font-space text-3xl font-black text-white">{content.title} built for modern security teams</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">{content.overview}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {content.features.map((feature) => (
            <article key={feature.title} className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
              <h3 className="font-space text-xl font-bold text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-8">
          <h2 className="font-space text-3xl font-black text-white">Ready to launch {content.title}?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-50/80">Partner with AntCrowd to move from detection to remediation with confidence.</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link to={ctaHref} className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300">
              {content.ctaLabel ?? 'Get Started'}
            </Link>
            <Link to="/contact/code" className="rounded-xl border border-amber-300/30 px-6 py-3 text-sm font-bold text-amber-100 transition hover:border-amber-300">
              Learn more
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
