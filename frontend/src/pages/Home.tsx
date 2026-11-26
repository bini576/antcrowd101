import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { brandAssets } from '@ant-ui';
import { PRODUCT_GET_STARTED_URL } from '../constants/productCta';

/* ── Data ────────────────────────────────────────────────────────── */

const navMenus = [
  { label: 'Platform', items: ['Bug Bounty','Pentest as a Service','VDP','Challenge','Trust Center','Training','AI Red Teaming','Code'] },
  { label: 'Solution', sections: [
      { title: 'Use Cases', items: ['AI Security, Safety & Trust','Application Security','Continuous Security Testing'] },
      { title: 'Industries', items: ['Automotive & Transportation','Financial Services','Healthcare'] },
  ]},
  { label: 'Partners', items: ['Partner Overview','Technology Alliance','Find A Channel Partner'] },
  { label: 'Researchers', items: ['Leaderboard','Disclosure Policy'] },
  { label: 'Company', items: ['About Us','Careers'] },
];

const solutionItems = ['AI Security, Safety & Trust','Application Security','Continuous Security Testing','Automotive & Transportation','Financial Services','Healthcare'];
const partnerItems = ['Partner Overview','Technology Alliance','Hackerone and AWS','Find A Channel Partner','Partner Portal','Integration Partners'];
const researcherItems = ['Leaderboard','Disclosure Policy'];

const logos = ['ramp','bdr','poly','PEDA','BIT','TIBEBE','MAKERSPACE','alyah','Harvey','pendo','COGNISYS'];

const serviceIcons: Record<string, string> = {
  'Bug Bounty': '🐛', 'Pentest as a Service': '🔍', VDP: '📋', Challenge: '🏆',
  'Trust Center': '🛡️', Training: '📚', 'AI Red Teaming': '🤖', Code: '💻',
};

const serviceDesc: Record<string, string> = {
  'Bug Bounty': 'Uncover security weaknesses with vetted researchers and continuous testing programs.',
  'Pentest as a Service': 'Run focused pentests with clear remediation guidance and faster validation cycles.',
  VDP: 'Receive, triage, and resolve vulnerability reports in a structured disclosure workflow.',
  Challenge: 'Launch scoped, time-bound testing events to validate critical assets quickly.',
  'Trust Center': 'Share your security posture with customers through a centralized trust portal.',
  Training: 'Improve team readiness with practical security awareness and process guidance.',
  'AI Red Teaming': 'Stress test AI systems for prompt injection, data leakage, and unsafe outputs.',
  Code: 'Find vulnerabilities earlier in development with code-focused security review support.',
};

const steps = [
  { num: '01', title: 'Define Your Scope', desc: 'Set up your security program, define assets, and configure testing parameters.' },
  { num: '02', title: 'Engage Researchers', desc: 'Vetted researchers test your assets using real-world attack techniques.' },
  { num: '03', title: 'Remediate & Verify', desc: 'Receive detailed findings, remediate issues, and verify fixes with retesting.' },
];

const hackForGoodImageUrl = brandAssets.journeyResearcher;

/* ── Helpers ──────────────────────────────────────────────────────── */

function getMenuItemPath(item: string) {
  const slug = item.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const map: Record<string, string> = {
    'Trust Center': '/product/trust-center', Code: '/product/code', 'Pentest as a Service': '/product/pentest',
    'Bug Bounty': '/product/bug-bounty', Challenge: '/product/challenge', 'AI Red Teaming': '/product/ai-red-teaming',
    VDP: '/platform/vdp-researcher', Training: '/product/training', 'About Us': '/company/about', Careers: '/company/careers',
  };
  if (map[item]) return map[item];
  if (solutionItems.includes(item)) return `/solutions/${slug}`;
  if (partnerItems.includes(item)) return `/partners/${slug}`;
  if (researcherItems.includes(item)) return `/researchers/${slug}`;
  return '#';
}

/* ── Component ───────────────────────────────────────────────────── */

export default function Home() {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const platformItems = navMenus.find(m => m.label === 'Platform')?.items ?? [];

  function clearCloseTimer() { if (closeTimerRef.current !== null) { window.clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }
  function openMenuNow(label: string) { clearCloseTimer(); setOpenMenu(label); }
  function closeMenuSoon() { clearCloseTimer(); closeTimerRef.current = window.setTimeout(() => setOpenMenu(null), 180); }

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('keydown', esc);
    return () => { clearCloseTimer(); document.removeEventListener('keydown', esc); };
  }, []);

  function navClick(label: string) {
    const routes: Record<string, string> = { Solution: '/solutions', Partners: '/partners', Researchers: '/researchers' };
    if (routes[label]) { setOpenMenu(null); navigate(routes[label]); }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-[Inter,-apple-system,sans-serif]">

      {/* ── Top strip ── */}
      <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />

      {/* ── Header ── */}
      <header className="border-b border-slate-800/60">
        {/* Top links */}
        <div className="max-w-7xl mx-auto flex justify-end gap-5 px-6 py-2 text-xs text-slate-400">
          <Link to="/researchers/login" className="hover:text-amber-400 transition">Researcher Sign In</Link>
          <Link to="/login" className="hover:text-amber-400 transition">Organization Sign In</Link>
          <Link to="/company/contact" className="hover:text-amber-400 transition">Contact Us</Link>
        </div>

        {/* Nav bar */}
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="text-amber-500 font-extrabold text-2xl tracking-tight">AntCrowd</div>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
            {navMenus.map(menu => (
              <div key={menu.label} className="relative" onMouseEnter={() => openMenuNow(menu.label)} onMouseLeave={closeMenuSoon}>
                <button type="button" className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition rounded-lg hover:bg-slate-800/50"
                  onClick={() => navClick(menu.label)}>
                  {menu.label}
                </button>

                {openMenu === menu.label && (
                  <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl p-2 z-50"
                    onMouseEnter={clearCloseTimer} onMouseLeave={closeMenuSoon}>
                    {'sections' in menu ? (
                      menu.sections?.map(s => (
                        <div key={s.title} className="mb-2">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.title}</div>
                          {s.items.map(item => {
                            const path = getMenuItemPath(item);
                            return path !== '#'
                              ? <Link key={item} to={path} onClick={() => setOpenMenu(null)} className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-amber-400 rounded-lg transition">{item}</Link>
                              : <span key={item} className="block px-3 py-2 text-sm text-slate-500">{item}</span>;
                          })}
                        </div>
                      ))
                    ) : (
                      menu.items.map(item => {
                        const path = getMenuItemPath(item);
                        return path !== '#'
                          ? <Link key={item} to={path} onClick={() => setOpenMenu(null)} className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-amber-400 rounded-lg transition">{item}</Link>
                          : <span key={item} className="block px-3 py-2 text-sm text-slate-500">{item}</span>;
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/researchers/leaderboard" className="text-sm text-slate-400 hover:text-white transition">Leaderboard</Link>
            <a href={PRODUCT_GET_STARTED_URL}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-bold transition shadow-lg shadow-amber-500/20">
              Get started
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/30" />
        <div className="absolute inset-0 opacity-[0.06] bg-[url('/hero-security-team.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.08),transparent_70%)]" />

        <div className="relative max-w-7xl mx-auto px-6 py-28 lg:py-36">
          <div className="max-w-2xl space-y-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight">
              Secure Your Business<br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Stay Compliant</span> All in One Platform
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed max-w-xl">
              AntCrowd helps you get compliant <em>fast.</em> Find and fix hidden vulnerabilities faster by accessing
              the region&apos;s best hackers and pentesters. Crowdsourced intelligence stops breaches before attackers can strike.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href={PRODUCT_GET_STARTED_URL}
                className="px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm transition shadow-xl shadow-amber-500/25">
                Get Started
              </a>
              <a href="#platform"
                className="px-7 py-3.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white font-semibold text-sm transition">
                View Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trusted by ── */}
      <section className="border-y border-slate-800/50 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <p className="text-center text-sm font-semibold text-slate-500 uppercase tracking-widest mb-8">Trusted by many customers, from school project to startup</p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            {logos.map(name => (
              <span key={name} className="text-slate-500 font-bold text-sm tracking-wider opacity-60 hover:opacity-100 transition">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform services grid ── */}
      <section id="platform" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">One platform for continuous exposure reduction</h2>
            <p className="text-slate-400 leading-relaxed">
              Continuous compliance and human insight working together to find, validate, and help you fix the vulnerabilities that matter.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {platformItems.map(item => (
              <Link key={item} to={getMenuItemPath(item)}
                className="group relative bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 hover:border-amber-500/30 hover:bg-slate-800/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5">
                <div className="text-3xl mb-4">{serviceIcons[item] ?? '🔒'}</div>
                <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition mb-2">{item}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{serviceDesc[item]}</p>
                <div className="absolute top-6 right-6 text-slate-600 group-hover:text-amber-500 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 bg-slate-900/40 border-y border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-4">
            <p className="text-amber-500 text-sm font-bold uppercase tracking-widest">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Start your journey</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="relative text-center space-y-4 p-6">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-xl font-extrabold">{s.num}</div>
                {i < steps.length - 1 && <div className="hidden md:block absolute top-12 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-gradient-to-r from-amber-500/30 to-transparent" />}
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hack for Good ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <p className="text-amber-500 text-sm font-bold uppercase tracking-widest">Security Researchers</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Hack for Good</h2>
              <p className="text-slate-400 leading-relaxed">Earn money, learn skills, be at the forefront of innovative technology:</p>
              <ul className="space-y-3">
                {['Compete and collaborate with top ethical researchers','Earn rewards, while making the internet a safer place','Build your skills at live events'].map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center text-xs font-bold">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-slate-700/40 shadow-2xl">
                <img src={hackForGoodImageUrl} alt="Security researchers" loading="lazy" className="w-full object-cover" />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 shadow-lg">
                <div className="text-amber-500 text-2xl font-extrabold">many</div>
                <div className="text-xs text-slate-400">security researchers at the ready</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800/50 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Products</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <a href="#" className="block hover:text-amber-400 transition">Pen Test as a Service</a>
                <div className="pl-3 space-y-2 border-l border-slate-800">
                  <a href="#" className="block hover:text-amber-400 transition">Web Application</a>
                  <a href="#" className="block hover:text-amber-400 transition">Network</a>
                  <a href="#" className="block hover:text-amber-400 transition">API</a>
                </div>
                <a href="#" className="block hover:text-amber-400 transition">Bug Bounty</a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Use Cases</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <Link to="/solutions/ai-security-safety-and-trust" className="block hover:text-amber-400 transition">AI Security, Safety & Trust</Link>
                <Link to="/solutions/application-security" className="block hover:text-amber-400 transition">Application Security</Link>
                <Link to="/solutions/continuous-security-testing" className="block hover:text-amber-400 transition">Continuous Security Testing</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Industries</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <Link to="/solutions/automotive-and-transportation" className="block hover:text-amber-400 transition">Automotive & Transportation</Link>
                <Link to="/solutions/financial-services" className="block hover:text-amber-400 transition">Financial Services</Link>
                <Link to="/solutions/healthcare" className="block hover:text-amber-400 transition">Healthcare</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Why AntCrowd</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <a href="#" className="block hover:text-amber-400 transition">Why Crowdsourcing is Better</a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Company</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <a href="#" className="block hover:text-amber-400 transition">Careers</a>
                <a href="#" className="block hover:text-amber-400 transition">Partners</a>
              </div>
              <h4 className="text-sm font-bold text-white mt-6 mb-4">For Hackers</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <a href="#" className="block hover:text-amber-400 transition">Programs</a>
                <a href="#" className="block hover:text-amber-400 transition">Leaderboard</a>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-800/50">
            <div className="flex items-center gap-6">
              <span className="text-amber-500 font-extrabold text-xl tracking-tight">AntCrowd</span>
              <a href={PRODUCT_GET_STARTED_URL} className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-bold transition">Get Started</a>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Copyright &copy; 2026 AntCrowd</span>
              <a href="/trust" className="hover:text-slate-300 transition">Security & Trust</a>
              <Link to="/terms-and-conditions" className="hover:text-slate-300 transition">Terms & Conditions</Link>
              <Link to="/privacy-policy" className="hover:text-slate-300 transition">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
