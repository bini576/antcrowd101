import { useEffect, useState } from "react";
import ControlCard from "../components/controls/ControlCard";
import { fetchCompliance, getOrgId, hasTrustApiConfig } from "../lib/trustApi";

type ControlItem = {
  title: string;
  status: string;
  evidenceUrl: string | null;
  items: string[];
  moreCount: number;
};

function getControlFeaturesByTitle(title: string): string[] {
  const normalized = title.toLowerCase();
  if (normalized.includes("infrastructure")) {
    return [
      "Service infrastructure maintained",
      "Production data backups conducted",
      "Database replication utilized",
    ];
  }
  if (normalized.includes("product security")) {
    return [
      "Secure SDLC with peer review",
      "SAST/DAST and dependency scanning",
      "Penetration testing and remediation tracking",
    ];
  }
  if (normalized.includes("data") || normalized.includes("privacy")) {
    return [
      "Data classification and retention controls",
      "Encryption in transit and at rest",
      "DPA, DPIA, and privacy request workflows",
    ];
  }
  if (normalized.includes("incident")) {
    return [
      "Incident response runbooks maintained",
      "On-call escalation and postmortems",
      "Security event monitoring in place",
    ];
  }
  return ["Control implementation documented", "Owner and review cadence defined"];
}

const controls: ControlItem[] = [
  {
    title: "Infrastructure security",
    status: "implemented",
    evidenceUrl: null,
    items: getControlFeaturesByTitle("Infrastructure security"),
    moreCount: 7,
  },
  {
    title: "Organizational Security",
    status: "implemented",
    evidenceUrl: null,
    items: [
      "Employee background checks performed",
      "Security awareness training implemented",
      "Confidentiality Agreement acknowledged",
    ],
    moreCount: 3,
  },
  {
    title: "Internal Security Procedures",
    status: "implemented",
    evidenceUrl: null,
    items: [
      "Continuity and disaster recovery plans tested",
      "Incident response plan maintained",
      "Risk assessments performed quarterly",
    ],
    moreCount: 4,
  },
  {
    title: "AI Security & Compliance",
    status: "implemented",
    evidenceUrl: null,
    items: [
      "AI system impact ",
      "Data governance for AI models",
      "Model monitoring controls in place",
    ],
    moreCount: 5,
  },
  {
    title: "Product Security",
    status: "implemented",
    evidenceUrl: null,
     items: [
      "AI system impact assessment",
      "Data governance for AI models",
      "Model monitoring controls in place",
    ],
    moreCount: 3,
  },
  {
    title: "Data & Privacy",
    status: "implemented",
    evidenceUrl: null,
    items: getControlFeaturesByTitle("Data & Privacy"),
    moreCount: 3,
  },
];

const infrastructureSections = [
  {
    title: "Compliance",
    items: [
      "SOC 2 Type II",
      "FedRAMP 20x",
      "ISO 27001:2022",
      "ISO/IEC 42001:2023",
      "ISO 27701",
      "ISO 27017",
      "ISO 27018",
      "GDPR",
      "CCPA",
      "Trusted Cloud Provider (CSA)",
      "AWS Security Competency",
      "Vanta SOC 2 Type 2",
      "ISO/IEC 42001 Certificate",
      "ISO/IEC 27001:2022 and 27701:2019 Certificate",
      "Resilience and Business Continuity at Vanta",
      "Vanta Secure Implementation Guidelines",
      "PCI-DSS 4.0.1 SAQ-A - Attestation of Compliance (2025)",
      "PCI-DSS 4.0.1 SAQ-D Service Provider - Attestation of Compliance (2025)",
      "SOC 2 Type II Bridge Letter - 1.3.2026",
    ],
  },
  {
    title: "Penetration Testing",
    items: [
      "Penetration Test Executive Summary Report incl. retest (Feb 2025)",
      "Penetration Test Status of Findings (Feb 2026)",
    ],
  },
  {
    title: "Questionnaires",
    items: [
      "Vanta's AI Security Assessment",
      "2025 Vanta CAIQv4.0.3",
      "2025 Vanta VSA Full",
      "2025 Vanta VSA Core",
    ],
  },
  {
    title: "Privacy",
    items: [
      "SaaS Platform DPIA",
      "Vanta Transfer Impact Analysis (TIA)",
      "Vanta's Data Processing Agreement (DPA)",
    ],
  },
  {
    title: "Miscellaneous",
    items: [
      "2025 Vanta W9",
      "Vanta Code of Conduct",
      "Vanta Certificate of Liability Insurance",
      "Vanta Architecture Diagram",
      "Vanta CMMC Shared Responsibility Matrix (CRM)",
      "Vanta Vendor Form",
      "Vanta Trail of Bits Report",
    ],
  },
  {
    title: "FedRAMP 20x Pilot",
    items: [
      "Vanta - FedRAMP 20x Pilot Draft Submission 05.19.2025",
      "Vanta - FedRAMP 20x Pilot Draft Submission 05.19.2025 (update)",
      "Schellman FedRAMP 20x Assessment Plan & Methodology (Vanta)",
      "Vanta - FedRAMP 20x KSI 3PAO Validation Workbook Final 05.30.2025 (Public)",
      "Vanta - FedRAMP 20x KSI 3PAO Validations and Digital Hash Final 05.30.2025 (Public)",
      "Vanta - FedRAMP 20x KSI 3PAO Validation Workbook 05.30.2025 (Non-Public)",
      "Vanta - FedRAMP 20x KSI 3PAO Validations and Digital Hash Final 05.30.2025 (Non-Public)",
      "Vanta - FedRAMP 20x Pilot Final Submission File 05.30.2025",
      "Vanta - FedRAMP 20xP1 POAM (June 2025)",
      "Vanta - FedRAMP 20xP1 Final Authorization Package Overview 07.18.2025 (Public)",
      "Vanta - FedRAMP 20x KSI 3PAO Validation Workbook Final 07.18.2025 (Non-Public)",
      "Vanta - FedRAMP 20x KSI 3PAO Validation Workbook Final 07.18.2025 (Public)",
      "Vanta - FedRAMP 20xP1 July POAM",
      "Vanta - FedRAMP 20x KSI 3PAO Validations Final 07.18.2025 (Public)",
      "Vanta - FedRAMP 20x KSI 3PAO Validations Final 07.18.2025 (Non-Public)",
      "Vanta - FedRAMP 20xP1 August POAM",
      "Vanta FedRAMP 20xP1 Authorization Package Overview (Public) 12.4.2025",
      "Vanta Ongoing Authorization Report (OAR) December 2025_Public Version",
    ],
  },
  {
    title: "PCI DSS",
    items: ["PCI DSS 4.0"],
  },
];

export default function ControlsPage() {
  const [items, setItems] = useState(controls);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [showInfrastructureDetails, setShowInfrastructureDetails] = useState(false);
  const [activeControlTitle, setActiveControlTitle] = useState<string | null>(null);
  const [activeControlItems, setActiveControlItems] = useState<string[]>([]);
  const [showAllControls, setShowAllControls] = useState(false);

  useEffect(() => {
    if (!hasTrustApiConfig()) return;

    fetchCompliance(getOrgId())
      .then((data) => {
        setLastUpdated(new Date().toLocaleString());
        if (!data.length) return;
        setItems(
          data.map((item) => ({
            title: item.framework,
            status: item.status ?? "implemented",
            evidenceUrl: item.evidence_url ?? null,
            items: getControlFeaturesByTitle(item.framework),
            moreCount: 3,
          }))
        );
      })
      .catch(() => {
        setLastUpdated(new Date().toLocaleString());
        // Keep default controls on backend error.
      });
  }, []);

  return (
    <main>
      <div className="flex items-center justify-between gap-3">
        <h1>Controls</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
            onClick={() => setShowAllControls(true)}
          >
            View all controls <span aria-hidden="true">↗</span>
          </button>
          {lastUpdated ? (
            <span className="text-sm text-slate-500">Last updated: {lastUpdated}</span>
          ) : null}
        </div>
      </div>
      <p className="mb-6 text-slate-600">Operational controls mapped to trust requirements.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((control) => (
          <ControlCard
            key={control.title}
            title={control.title}
            status={control.status}
            items={control.items}
            evidenceUrl={control.evidenceUrl}
            onTitleClick={() => {
              if (control.title.toLowerCase().includes("infrastructure security")) {
                setShowInfrastructureDetails(true);
                return;
              }
              setActiveControlTitle(control.title);
              setActiveControlItems(control.items);
            }}
            detailsLabel={`View ${control.moreCount} more ${control.title} controls`}
            onOpenDetails={() => {
              if (control.title.toLowerCase().includes("infrastructure security")) {
                setShowInfrastructureDetails(true);
                return;
              }
              setActiveControlTitle(control.title);
              setActiveControlItems(control.items);
            }}
          />
        ))}
      </div>
      {showInfrastructureDetails ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:p-8" onClick={() => setShowInfrastructureDetails(false)}>
          <div
            className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Infrastructure Security Documents</h2>
              <button
                type="button"
                className="text-slate-600 hover:text-slate-900"
                onClick={() => setShowInfrastructureDetails(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-6">
              {infrastructureSections.map((section) => (
                <section key={section.title}>
                  <h3 className="mb-2 font-semibold text-slate-900">{section.title}</h3>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {activeControlTitle ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:p-8" onClick={() => setActiveControlTitle(null)}>
          <div
            className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{activeControlTitle}</h2>
              <button
                type="button"
                className="text-slate-600 hover:text-slate-900"
                onClick={() => setActiveControlTitle(null)}
              >
                Close
              </button>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-slate-700">
              {activeControlItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {showAllControls ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:p-8" onClick={() => setShowAllControls(false)}>
          <div
            className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">All Controls</h2>
              <button
                type="button"
                className="text-slate-600 hover:text-slate-900"
                onClick={() => setShowAllControls(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-6">
              {items.map((control) => (
                <section key={control.title}>
                  <h3 className="mb-2 font-semibold text-slate-900">{control.title}</h3>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700">
                    {control.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
