import React from "react";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string | number;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  className = ""
}: TableProps<T>) {
  return (
    <div className={`w-full overflow-x-auto border border-paper-rule rounded-sm bg-paper-card ${className}`}>
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-paper-rule bg-paper">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`py-2 px-3 t-micro text-ink-muted ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                } ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={keyExtractor ? keyExtractor(row, rowIdx) : rowIdx}
              className="border-b border-paper-rule/60 hover:bg-paper-sunk/40 transition-colors last:border-b-0"
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={`py-2 px-3 t-body text-xs text-ink ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  } ${col.className || ""}`}
                >
                  {col.cell ? col.cell(row) : col.accessorKey ? String(row[col.accessorKey] ?? "—") : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
