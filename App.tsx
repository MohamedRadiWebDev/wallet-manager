
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

  useEffect(() => {
    initSettings().then(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-pulse text-xl font-bold text-slate-600">جاري التحميل...</div>
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
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

export default App;
