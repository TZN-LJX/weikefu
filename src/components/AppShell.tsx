import type { ReactNode } from 'react'
import { BookOpenCheck, ChartCandlestick, GraduationCap, Map, Settings, Target } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navigation = [
  { to: '/today', label: '今日', Icon: Target },
  { to: '/curriculum', label: '闯关', Icon: Map },
  { to: '/training', label: '训练', Icon: ChartCandlestick },
  { to: '/review', label: '复盘', Icon: BookOpenCheck },
]

function NavigationLinks() {
  return <>{navigation.map(({ to, label, Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={20} /><span>{label}</span></NavLink>)}</>
}

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-layout">
    <aside className="desktop-sidebar">
      <div className="brand-block"><GraduationCap size={25} /><div><strong>威科夫训练</strong><span>ETH 决策实验室</span></div></div>
      <nav aria-label="主导航"><NavigationLinks /></nav>
      <NavLink className="settings-link" to="/settings" title="设置"><Settings size={19} /><span>设置</span></NavLink>
    </aside>
    <main className="app-main">{children}</main>
    <nav className="mobile-nav" aria-label="手机主导航"><NavigationLinks /></nav>
    <NavLink className="mobile-settings" to="/settings" title="设置"><Settings size={20} /></NavLink>
  </div>
}
