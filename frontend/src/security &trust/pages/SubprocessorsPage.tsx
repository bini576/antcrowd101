import { useEffect, useState } from "react";
import SubprocessorTable from "../components/subprocessors/SubprocessorTable";
import { fetchSubprocessors, getOrgId, hasTrustApiConfig } from "../lib/trustApi";

const defaultRows = [
  {
    name: "AWS",
    purpose: "Cloud infrastructure hosting",
    region: "US",
  },
  {
    name: "Cloudflare",
    purpose: "Edge network and DDoS protection",
    region: "Global",
  },
  {
    name: "Datadog",
    purpose: "Monitoring and observability",
    region: "US/EU",
  },
];

export default function SubprocessorsPage() {
  const [rows, setRows] = useState(defaultRows);

  useEffect(() => {
    if (!hasTrustApiConfig()) return;

    fetchSubprocessors(getOrgId())
      .then((items) =>
        setRows(
          items.map((item) => ({
            name: item.name,
            purpose: item.purpose ?? "",
            region: item.location ?? "",
          }))
        )
      )
      .catch(() => {
        // Keep default rows on backend error.
      });
  }, []);

  return (
    <main>
      <h1>Subprocessors</h1>
      <p className="mb-6 text-slate-600">Vendors that process data on our behalf.</p>
      <SubprocessorTable rows={rows} />
    </main>
  );
}
