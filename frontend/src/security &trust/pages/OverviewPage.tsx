import { useEffect, useState } from "react";
import OverviewCard from "../components/overview/OverviewCard";
import { fetchOverviews, hasTrustApiConfig } from "../lib/trustApi";

const defaultStats = [
  {
    title: "Uptime",
    value: "99.98%",
    description: "Rolling 90-day availability across production services.",
  },
  {
    title: "Incidents",
    value: "0 Critical",
    description: "No open severity-1 incidents.",
  },
  {
    title: "Certifications",
    value: "SOC 2 Type II",
    description: "Independent audit attestation and annual review in place.",
  },
];

export default function OverviewPage() {
  const [stats, setStats] = useState(defaultStats);

  useEffect(() => {
    if (!hasTrustApiConfig()) return;

    fetchOverviews()
      .then((items) => {
        if (!items.length) return;
        const latest = items[items.length - 1];
        setStats([
          {
            title: "Summary",
            value: "Trust Overview",
            description: latest.summary,
          },
          {
            title: "Security Commitment",
            value: latest.security_commitment ? "Published" : "Not set",
            description: latest.security_commitment ?? "No security commitment text published.",
          },
          {
            title: "Contact",
            value: latest.contact_email ?? "Not set",
            description: "Primary trust and security contact.",
          },
        ]);
      })
      .catch(() => {
        // Keep default overview stats on backend error.
      });
  }, []);

  return (
    <main>
      <h1>Overview</h1>
      <p className="mb-6 text-slate-600">Current security and reliability posture.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <OverviewCard
            key={item.title}
            title={item.title}
            value={item.value}
            description={item.description}
          />
        ))}
      </div>
    </main>
  );
}
