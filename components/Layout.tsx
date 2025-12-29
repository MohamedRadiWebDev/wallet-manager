
import React from 'react';
import { LayoutDashboard, History, Settings, Wallet as WalletIcon, Moon, Sun } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: any) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, theme, onToggleTheme }) => {
  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'transactions', label: 'الحركات', icon: History },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-sm z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
            <WalletIcon size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">مدير المحافظ</h1>
          </div>
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 font-semibold' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
