import { useEffect, useState } from "react";
import UpdateList from "../components/updates/UpdateList";
import { fetchUpdates, getOrgId, hasTrustApiConfig } from "../lib/trustApi";

const defaultUpdates = [
  {
    id: "u1",
    title: "Quarterly access review completed",
    date: "Jan 15, 2026",
    detail: "All production IAM roles were validated and unnecessary privileges removed.",
  },
  {
    id: "u2",
    title: "Backup retention policy expanded",
    date: "Apr 02, 2026",
    detail: "Extended encrypted backup retention from 30 to 45 days.",
  },
  {
    id: "u3",
    title: "Dependency scanning improvements",
    date: "march 11, 2026",
    detail: "CI now blocks merges when high-severity vulnerabilities are detected.",
  },
];

export default function UpdatesPage() {
  const [updates, setUpdates] = useState(defaultUpdates);

  useEffect(() => {
    if (!hasTrustApiConfig()) return;

    fetchUpdates(getOrgId())
      .then((items) =>
        setUpdates(
          items.map((item) => ({
            id: item.id,
            title: item.title,
            date: item.published_at
              ? new Date(item.published_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                })
              : "",
            detail: item.content,
          }))
        )
      )
      .catch(() => {
        // Keep default updates on backend error.
      });
  }, []);

  return (
    <main>
      <h1>Updates</h1>
      <p className="mb-6 text-slate-600">Latest security and compliance updates.</p>
      <UpdateList updates={updates} />
    </main>
  );
}
