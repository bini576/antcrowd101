type Update = {
  id: string;
  title: string;
  date: string;
  detail: string;
};

type Props = {
  updates: Update[];
};

export default function UpdateList({ updates }: Props) {
  return (
    <ul className="space-y-4">
      {updates.map((update) => (
        <li key={update.id} className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">{update.date}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{update.title}</h2>
          <p className="mt-2 text-sm text-slate-700">{update.detail}</p>
        </li>
      ))}
    </ul>
  );
}
