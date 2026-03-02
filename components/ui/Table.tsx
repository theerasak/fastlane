interface TableProps {
  headers: string[]
  children: React.ReactNode
  emptyMessage?: string
  isEmpty?: boolean
}

export function Table({ headers, children, emptyMessage = 'No records found.', isEmpty }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {isEmpty ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-8 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 text-sm text-gray-900 ${className}`}>
      {children}
    </td>
  )
}

export function Tr({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <tr className={`hover:bg-gray-50 transition-colors ${className}`}>{children}</tr>
}
