import type { ReactNode } from "react";
export interface AdminColumn<T> {
  label: string;
  render: (item: T) => ReactNode;
}
export function AdminTable<T extends { id: string }>({
  columns,
  items,
}: {
  columns: AdminColumn<T>[];
  items: T[];
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {columns.map((column) => (
                <td key={column.label}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
