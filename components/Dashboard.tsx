
import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Wallet, WalletStats, TransactionType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, Activity } from 'lucide-react';

const WALLET_CONFIG: Record<Wallet, { name: string; color: string; bg: string }> = {
  [Wallet.VODAFONE]: { name: 'فودافون كاش', color: '#e60000', bg: 'bg-red-50' },
  [Wallet.ETISALAT]: { name: 'اتصالات كاش', color: '#7fba00', bg: 'bg-green-50' },
  [Wallet.INSTAPAY]: { name: 'إنستا باي', color: '#6366f1', bg: 'bg-indigo-50' },
  [Wallet.FAWRY]: { name: 'فوري', color: '#facc15', bg: 'bg-yellow-50' },
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<WalletStats[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const settings = await db.settings.get('main');
      const transactions = await db.transactions.toArray();
      const opening = settings?.openingBalances || { 
        [Wallet.VODAFONE]: 0, [Wallet.ETISALAT]: 0, [Wallet.INSTAPAY]: 0, [Wallet.FAWRY]: 0 
      };

      const walletStats = Object.values(Wallet).map(w => {
        const walletTx = transactions.filter(t => t.wallet === w);
        const deposits = walletTx.filter(t => t.type === TransactionType.DEPOSIT).reduce((acc, t) => acc + t.amount, 0);
        const withdrawals = walletTx.filter(t => t.type === TransactionType.WITHDRAW).reduce((acc, t) => acc + t.amount, 0);
        
        return {
          wallet: w,
          balance: opening[w] + deposits - withdrawals,
          totalDeposits: deposits,
          totalWithdrawals: withdrawals,
          transactionCount: walletTx.length
        };
      });

      setStats(walletStats);
      setTotalBalance(walletStats.reduce((acc, s) => acc + s.balance, 0));
    };

    fetchStats();
  }, []);

  const chartData = stats.map(s => ({
    name: WALLET_CONFIG[s.wallet].name,
    balance: s.balance,
    color: WALLET_CONFIG[s.wallet].color
  }));

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">نظرة عامة</h2>
          <p className="text-slate-500 dark:text-slate-400">مرحباً بك، إليك ملخص أرصدة المحافظ اليوم.</p>
        </div>
        <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-full text-white shadow-lg shadow-blue-200">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">إجمالي الرصيد المجمع</p>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-200">{totalBalance.toLocaleString()} <span className="text-sm">ج.م</span></p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.wallet} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-1.5 h-full`} style={{ backgroundColor: WALLET_CONFIG[s.wallet].color }}></div>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-xl ${WALLET_CONFIG[s.wallet].bg}`} style={{ color: WALLET_CONFIG[s.wallet].color }}>
                <WalletIcon size={24} />
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 uppercase tracking-wider">{s.transactionCount} عملية</span>
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{WALLET_CONFIG[s.wallet].name}</h3>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">{s.balance.toLocaleString()} <span className="text-sm">ج.م</span></p>
            
            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-50 dark:border-slate-800">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase">إيداع</span>
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                  <TrendingUp size={12} /> {s.totalDeposits.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase">سحب</span>
                <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                  <TrendingDown size={12} /> {s.totalWithdrawals.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Section */}
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
          <Activity className="text-blue-600" size={20} />
          توزيع الأرصدة الحالية
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              <Bar dataKey="balance" radius={[6, 6, 0, 0]} barSize={50}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
