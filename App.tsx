
import React, { useState, useEffect } from 'react';
import { initSettings } from './db';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { SettingsPage } from './components/SettingsPage';

enum View {
  DASHBOARD = 'dashboard',
  TRANSACTIONS = 'transactions',
  SETTINGS = 'settings'
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    initSettings().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      return;
    }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-pulse text-xl font-bold text-slate-600 dark:text-slate-200">جاري التحميل...</div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard />;
      case View.TRANSACTIONS:
        return <Transactions />;
      case View.SETTINGS:
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView} theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {renderView()}
    </Layout>
  );
};

export default App;
