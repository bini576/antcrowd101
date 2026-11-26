import { useEffect, useState } from "react";
import FAQAccordion from "../components/faq/FAQAccordion";
import { fetchFaq, getOrgId, hasTrustApiConfig } from "../lib/trustApi";

const defaultItems = [
  {
    question: "How often is infrastructure access reviewed?",
    answer: "Access permissions are reviewed quarterly and on role changes.",
  },
  {
    question: "Is customer data encrypted?",
    answer: "Yes. Data is encrypted in transit and at rest.",
  },
  {
    question: "How do you handle incidents?",
    answer: "We follow an incident response process with defined severity and escalation paths.",
  },
];

export default function FaqPage() {
  const [items, setItems] = useState(defaultItems);

  useEffect(() => {
    if (!hasTrustApiConfig()) return;

    fetchFaq(getOrgId())
      .then((faqItems) =>
        setItems(
          faqItems.map((item) => ({
            question: item.question,
            answer: item.answer,
          }))
        )
      )
      .catch(() => {
        // Keep default FAQ on backend error.
      });
  }, []);

  return (
    <main>
      <h1>FAQ</h1>
      <p className="mb-6 text-slate-600">Answers to common trust and security questions.</p>
      <FAQAccordion items={items} />
    </main>
  );
}
