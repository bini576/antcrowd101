import { ReactNode } from "react";

type Props = {
  title: string;
  status: string;
  items?: string[];
  evidenceUrl?: string | null;
  detailsLabel?: string;
  onTitleClick?: () => void;
  onOpenDetails?: () => void;
  itemIcon?: ReactNode;
  className?: string;
};

export default function ControlCard({
  title,
  status,
  items,
  evidenceUrl,
  detailsLabel,
  onTitleClick,
  onOpenDetails,
  itemIcon,
  className,
}: Props) {
  const checklist =
    items && items.length
      ? items
      : ["Service infrastructure maintained", "Production data backups conducted"];

  return (
    <div className={`bg-white p-6 rounded-xl shadow hover:shadow-lg transition ${className ?? ""}`}>
      <div className="flex justify-between items-center mb-2">
        {onTitleClick ? (
          <button type="button" onClick={onTitleClick} className="font-semibold text-left hover:underline">
            {title}
          </button>
        ) : (
          <h2 className="font-semibold">{title}</h2>
        )}
        <span className="text-green-600 font-medium">{status}</span>
      </div>
      <ul className="space-y-1 text-gray-600">
        {checklist.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="text-green-600">{itemIcon ?? "✔"}</span> {item}
          </li>
        ))}
      </ul>
      {evidenceUrl ? (
        <a href={evidenceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline mt-2 block">
          <span className="inline-flex items-center gap-1">
            View all <span aria-hidden="true">↗</span>
          </span>
        </a>
      ) : detailsLabel && onOpenDetails ? (
        <button type="button" onClick={onOpenDetails} className="text-blue-600 hover:underline mt-2 block">
          <span className="inline-flex items-center gap-1">
            {detailsLabel} <span aria-hidden="true">↗</span>
          </span>
        </button>
      ) : (
        <span className="text-slate-500 mt-2 block">Control details</span>
      )}
    </div>
  );
}
