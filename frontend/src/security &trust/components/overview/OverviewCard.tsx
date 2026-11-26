type Props = {
  title: string;
  value: string;
  description: string;
};

export default function OverviewCard({ title, value, description }: Props) {
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </article>
  );
}
