import type { ReactNode } from 'react'
import { GraduationCap, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-layout">
    <aside className="app-rail">
      <Link className="brand-block" to="/">
        <GraduationCap size={25} />
        <div><strong>威科夫闯关</strong><span>ETH 原书与历史回放</span></div>
      </Link>
      <Link className="settings-link" to="/settings" title="设置"><Settings size={20} /><span>设置</span></Link>
    </aside>
    <main className="app-main">{children}</main>
  </div>
}
