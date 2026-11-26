import { useEffect, useState } from "react";
import ResourceCard from "../components/resources/ResourceCard";
import { fetchResources, getOrgId, hasTrustApiConfig } from "../lib/trustApi";

const defaultResources = [
 
  {
    title: "Penetration Test Executive Summary",
    type: "Assessment",
    href: "#",
  },
  {
    title: "Security Whitepaper",
    type: "Document",
    href: "#",
  },
];

export default function ResourcesPage() {
  const [resources, setResources] = useState(defaultResources);

  useEffect(() => {
    if (!hasTrustApiConfig()) return;

    fetchResources(getOrgId())
      .then((items) =>
        setResources(
          items.map((item) => ({
            title: item.title,
            type: item.resource_type ?? "Resource",
            href: item.url ?? "#",
          }))
        )
      )
      .catch(() => {
        // Keep default resources on backend error.
      });
  }, []);

  return (
    <main>
      <h1>Resources</h1>
      <p className="mb-6 text-slate-600">Downloadable security and compliance resources.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {resources.map((resource) => (
          <ResourceCard
            key={resource.title}
            title={resource.title}
            type={resource.type}
            href={resource.href}
          />
        ))}
      </div>
    </main>
  );
}
