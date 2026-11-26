import type { ReactNode } from 'react';

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  empty
}: {
  columns: Array<{ key: string; label: string; render?: (row: T) => ReactNode }>;
  rows: T[];
  empty?: ReactNode;
}) {
  if (!rows.length) {
    return <div className="antui-table-empty">{empty || 'No data available yet.'}</div>;
  }

  return (
    <div className="antui-table-wrap">
      <table className="antui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id || row.key || index)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? '-')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
