type Subprocessor = {
  name: string;
  purpose: string;
  region: string;
};

type Props = {
  rows: Subprocessor[];
};

export default function SubprocessorTable({ rows }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Purpose</th>
            <th className="px-4 py-3 font-medium">Region</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t">
              <td className="px-4 py-3 text-slate-900">{row.name}</td>
              <td className="px-4 py-3 text-slate-700">{row.purpose}</td>
              <td className="px-4 py-3 text-slate-700">{row.region}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
