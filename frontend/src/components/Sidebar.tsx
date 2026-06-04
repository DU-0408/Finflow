'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ArrowLeftRight, ShieldAlert, Activity,
  Cloud, FlaskConical, HeartPulse, ChevronLeft, ChevronRight,
  Sun, Moon,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',              label: 'Overview',      icon: LayoutDashboard },
  { href: '/transactions',  label: 'Transactions',  icon: ArrowLeftRight },
  { href: '/fraud',         label: 'Fraud Center',  icon: ShieldAlert },
  { href: '/monitoring',    label: 'Monitoring',    icon: Activity },
  { href: '/aws',           label: 'AWS Infra',     icon: Cloud },
  { href: '/simulate',      label: 'Simulate',      icon: FlaskConical },
  { href: '/services',      label: 'Services',      icon: HeartPulse },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  theme: string;
  onThemeToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle, theme, onThemeToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border-2)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-base)',
        zIndex: 800,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 16px' : '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border-2)',
        minHeight: '68px',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--primary), hsl(263, 70%, 58%))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '1rem',
          color: 'white',
          flexShrink: 0,
        }}>
          FF
        </div>
        {!collapsed && (
          <div style={{ animation: 'fadeIn 200ms ease-out' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
              FinFlow
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-4)', marginTop: '-2px' }}>
              Banking Pipeline
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '10px 16px' : '10px 16px',
                borderRadius: 'var(--radius-md)',
                color: active ? 'var(--primary)' : 'var(--text-3)',
                background: active ? 'var(--primary-bg)' : 'transparent',
                fontWeight: active ? 600 : 400,
                fontSize: '0.875rem',
                transition: 'all var(--transition-fast)',
                position: 'relative',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--bg-3)';
                if (!active) e.currentTarget.style.color = 'var(--text-1)';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent';
                if (!active) e.currentTarget.style.color = 'var(--text-3)';
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3,
                  height: 20,
                  borderRadius: '0 3px 3px 0',
                  background: 'var(--primary)',
                }} />
              )}
              <Icon size={20} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 8px',
        borderTop: '1px solid var(--border-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        <button
          onClick={onThemeToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-3)',
            fontSize: '0.875rem',
            transition: 'all var(--transition-fast)',
            width: '100%',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <button
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-3)',
            fontSize: '0.875rem',
            transition: 'all var(--transition-fast)',
            width: '100%',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
