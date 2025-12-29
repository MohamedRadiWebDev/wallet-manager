
import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Wallet, Settings } from '../types';
import { Save, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [openingBalances, setOpeningBalances] = useState<Record<Wallet, number>>({
    [Wallet.VODAFONE]: 0,
    [Wallet.ETISALAT]: 0,
    [Wallet.INSTAPAY]: 0,
    [Wallet.FAWRY]: 0,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    db.settings.get('main').then(settings => {
      if (settings) setOpeningBalances(settings.openingBalances);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await db.settings.put({ id: 'main', openingBalances });
    setIsSaving(false);
    setMsg('تم حفظ الأرصدة الافتتاحية بنجاح.');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleReset = async () => {
    if (window.confirm('خطر! هل أنت متأكد من مسح جميع الحركات والبيانات؟ لا يمكن التراجع عن هذا الإجراء.')) {
      await db.transactions.clear();
      await db.settings.put({
        id: 'main',
        openingBalances: {
          [Wallet.VODAFONE]: 0,
          [Wallet.ETISALAT]: 0,
          [Wallet.INSTAPAY]: 0,
          [Wallet.FAWRY]: 0,
        }
      });
      window.location.reload();
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-2xl">
      <header>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">إعدادات النظام</h2>
        <p className="text-slate-500 dark:text-slate-400">تخصيص الأرصدة الافتتاحية وإدارة قاعدة البيانات.</p>
      </header>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-800 pb-4">الأرصدة الافتتاحية</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Object.values(Wallet).map((w) => (
            <div key={w} className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{w}</label>
              <div className="relative">
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-bold text-slate-700 dark:text-slate-200"
                  value={openingBalances[w]}
                  onChange={(e) => setOpeningBalances({ ...openingBalances, [w]: parseFloat(e.target.value) || 0 })}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">ج.م</span>
              </div>
            </div>
          ))}
        </div>

        {msg && <p className="text-green-600 dark:text-green-200 font-bold text-sm bg-green-50 dark:bg-green-500/10 p-3 rounded-lg border border-green-100 dark:border-green-500/20">{msg}</p>}

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />} 
          حفظ الإعدادات
        </button>
      </section>

      <section className="bg-red-50 dark:bg-red-500/10 p-8 rounded-2xl border border-red-100 dark:border-red-500/20 space-y-4">
        <div className="flex items-start gap-4">
          <div className="bg-red-100 dark:bg-red-500/20 p-2 rounded-lg text-red-600 dark:text-red-200">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-700 dark:text-red-200">منطقة الخطر</h3>
            <p className="text-red-600/70 dark:text-red-200/70 text-sm">إعادة ضبط المصنع ستمسح جميع البيانات المسجلة محلياً في هذا المتصفح.</p>
          </div>
        </div>
        
        <button 
          onClick={handleReset}
          className="bg-white dark:bg-slate-900 text-red-600 dark:text-red-200 border border-red-200 dark:border-red-500/30 py-3 px-6 rounded-2xl font-bold hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
        >
          <Trash2 size={20} /> مسح كافة البيانات
        </button>
      </section>
    </div>
  );
};
