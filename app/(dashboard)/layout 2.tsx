import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside
        className="fixed top-0 left-0 h-screen w-56 flex flex-col"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
      >
        <div className="px-5 py-6">
          <div className="mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Claude
          </div>
          <div className="text-lg font-semibold mt-1" style={{ color: 'var(--accent)' }}>
            Dashboard
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3 mt-2 flex-1">
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded text-sm transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/projects"
            className="px-3 py-2 rounded text-sm transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Projects
          </Link>
          <Link
            href="/dashboard/tasks"
            className="px-3 py-2 rounded text-sm transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Tasks
          </Link>
        </nav>
        <div className="px-5 py-4 mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
          /api/mcp ↗
        </div>
      </aside>
      <main className="flex-1 ml-56 overflow-auto" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
