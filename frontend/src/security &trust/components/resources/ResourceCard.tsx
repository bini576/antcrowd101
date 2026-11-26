type Props = {
  title: string;
  type: string;
  href: string;
};

export default function ResourceCard({ title, type, href }: Props) {
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{type}</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">{title}</h2>
      <a href={href} className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
        Open resource
      </a>
    </article>
  );
}
