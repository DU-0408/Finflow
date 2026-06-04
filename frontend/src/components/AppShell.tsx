'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState('dark');
  const pathname = usePathname();
  const { status } = useSession();

  useEffect(() => {
    const saved = localStorage.getItem('finflow-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('finflow-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Don't show sidebar on login page or when unauthenticated
  if (pathname === '/login' || status === 'unauthenticated') {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="spinner spinner-lg" />
        <span>Loading FinFlow...</span>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        {children}
      </main>
    </div>
  );
}
