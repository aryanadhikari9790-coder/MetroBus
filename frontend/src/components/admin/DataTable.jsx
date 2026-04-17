export default function DataTable({ columns = [], rows = [], emptyText = "No data found." }) {
  const hasColumns = columns.length > 0;
  const normalizedColumns = hasColumns ? columns : [{ key: "__empty__", label: "Data" }];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {normalizedColumns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!hasColumns ? (
              <tr>
                <td className="px-4 py-5 text-sm text-slate-500" colSpan={normalizedColumns.length}>
                  Table configuration is missing columns.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-sm text-slate-500" colSpan={normalizedColumns.length}>{emptyText}</td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={row.id || index} className="border-t border-slate-100">
                {normalizedColumns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-slate-700">
                    {typeof column.render === "function" ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
