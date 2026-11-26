type FAQItem = {
  question: string;
  answer: string;
};

type Props = {
  items: FAQItem[];
};

export default function FAQAccordion({ items }: Props) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details key={item.question} className="rounded-xl border bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-medium text-slate-900">{item.question}</summary>
          <p className="mt-2 text-sm text-slate-700">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
