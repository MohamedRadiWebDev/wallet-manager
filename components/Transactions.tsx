
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db';
import { Transaction, TransactionType, Wallet } from '../types';
import { Plus, Search, Trash2, Edit2, ArrowRightLeft, Download, Upload, FileJson, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { backupToJSON } from '../utils/dataHandlers';
import { ImportExportModal } from './ImportExportModal';

const WALLET_LABELS: Record<Wallet, string> = {
  [Wallet.VODAFONE]: 'فودافون',
  [Wallet.ETISALAT]: 'اتصالات',
  [Wallet.INSTAPAY]: 'إنستا باي',
  [Wallet.FAWRY]: 'فوري'
};

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; groupId: string | null } | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [walletFilter, setWalletFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchTransactions = async () => {
    const data = await db.transactions.reverse().sortBy('date');
    setTransactions(data);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = (
        t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.accountNumber?.includes(searchTerm) ||
        t.note?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesWallet = walletFilter === 'all' || t.wallet === walletFilter;
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      return matchesSearch && matchesWallet && matchesType;
    });
  }, [transactions, searchTerm, walletFilter, typeFilter]);

  const handleDeleteClick = (id: string, groupId?: string | null) => {
    if (groupId) {
      setDeleteDialog({ id, groupId });
    } else {
      if (window.confirm('هل أنت متأكد من حذف هذه الحركة؟')) {
        setTransactions((prev) => prev.filter((tx) => tx.id !== id));
        db.transactions.delete(id).then(() => fetchTransactions());
      }
    }
  };

  const applyOptimisticDelete = (id: string, groupId: string | null, mode: 'single' | 'group') => {
    setTransactions((prev) => {
      if (mode === 'group' && groupId) {
        return prev.filter((tx) => tx.transferGroupId !== groupId);
      }

      return prev
        .filter((tx) => tx.id !== id)
        .map((tx) =>
          groupId && tx.transferGroupId === groupId
            ? { ...tx, transferGroupId: null }
            : tx
        );
    });
  };

  const handleConfirmDelete = async (mode: 'single' | 'group') => {
    if (!deleteDialog) return;

    try {
      if (mode === 'group' && deleteDialog.groupId) {
        // تأكيد إضافي لحذف التحويل بالكامل كما طلب المستخدم
        if (window.confirm('تنبيه: سيتم حذف طرفي التحويل (السحب والإيداع) معاً. هل تريد الاستمرار؟')) {
          applyOptimisticDelete(deleteDialog.id, deleteDialog.groupId, mode);
          await db.transaction('rw', db.transactions, async () => {
            const related = await db.transactions.where('transferGroupId').equals(deleteDialog.groupId).toArray();
            await db.transactions.bulkDelete(related.map(r => r.id));
          });
        } else {
          // إذا ألغى التأكيد الثاني، نغلق الدايلوج فقط دون حذف
          setDeleteDialog(null);
          return;
        }
      } else {
        applyOptimisticDelete(deleteDialog.id, deleteDialog.groupId, mode);
        await db.transaction('rw', db.transactions, async () => {
          await db.transactions.delete(deleteDialog.id);
          if (deleteDialog.groupId) {
            await db.transactions.where('transferGroupId').equals(deleteDialog.groupId).modify({ transferGroupId: null });
          }
        });
      }
      
      // إغلاق الدايلوج وتحديث البيانات فوراً
      setDeleteDialog(null);
      await fetchTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("حدث خطأ أثناء محاولة الحذف.");
    }
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsFormOpen(true);
  };

  const handleBackup = () => {
    backupToJSON();
  };


  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">سجل الحركات</h2>
          <p className="text-slate-500 dark:text-slate-400">إدارة وتدقيق جميع عمليات الإيداع والسحب.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleBackup}
            className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-all font-medium"
          >
            <FileJson size={18} /> نسخة احتياطية
          </button>
          <button
            onClick={() => setIsImportExportOpen(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-all font-medium shadow-lg shadow-emerald-100"
          >
            <FileSpreadsheet size={18} /> Import / Export
          </button>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 flex items-center gap-2 transition-all shadow-lg shadow-blue-100 font-bold"
          >
            <Plus size={20} /> إضافة حركة
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">بحث</label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="اسم العميل، الرقم، الملاحظات..." 
              className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-700 dark:text-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">المحفظة</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-slate-700 dark:text-slate-200"
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
          >
            <option value="all">كل المحافظ</option>
            {Object.values(Wallet).map(w => <option key={w} value={w}>{WALLET_LABELS[w]}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">نوع العملية</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-slate-700 dark:text-slate-200"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">الكل</option>
            <option value={TransactionType.DEPOSIT}>إيداع</option>
            <option value={TransactionType.WITHDRAW}>سحب</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsImportExportOpen(true)}
            className="flex-1 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition-all text-sm font-medium"
          >
            <Download size={18} /> تصدير
          </button>
          <button
            onClick={() => setIsImportExportOpen(true)}
            className="flex-1 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition-all text-sm font-medium"
          >
            <Upload size={18} /> استيراد
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">التاريخ</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">المصدر</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">النوع</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">المبلغ</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">التفاصيل</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 font-medium">{tx.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      tx.wallet === Wallet.VODAFONE ? 'bg-red-50 text-red-600 border-red-100' :
                      tx.wallet === Wallet.ETISALAT ? 'bg-green-50 text-green-600 border-green-100' :
                      tx.wallet === Wallet.INSTAPAY ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                      'bg-yellow-50 text-yellow-600 border-yellow-100'
                    }`}>
                      {WALLET_LABELS[tx.wallet]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {tx.transferGroupId ? <span title="هذه العملية جزء من تحويل"><ArrowRightLeft size={14} className="text-blue-500" /></span> : null}
                      <span className={`text-xs font-bold ${tx.type === TransactionType.DEPOSIT ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.type === TransactionType.DEPOSIT ? 'إيداع' : 'سحب'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-slate-800 dark:text-slate-100">{tx.amount.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs truncate">
                      {tx.customerName && <span className="font-bold text-slate-700 dark:text-slate-200 ml-1">{tx.customerName}</span>}
                      {tx.accountNumber && <span className="text-slate-400 ml-1">({tx.accountNumber})</span>}
                      {tx.note && <span className="block italic mt-0.5 text-slate-400">{tx.note}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(tx)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteClick(tx.id, tx.transferGroupId)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    لا توجد حركات مطابقة للبحث أو الفلترة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-4 md:hidden">
        {filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
          <div key={tx.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{tx.date}</span>
              <span className={`text-xs font-bold ${tx.type === TransactionType.DEPOSIT ? 'text-green-600' : 'text-red-500'}`}>
                {tx.type === TransactionType.DEPOSIT ? 'إيداع' : 'سحب'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">{WALLET_LABELS[tx.wallet]}</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100">{tx.amount.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {tx.customerName && <div className="font-bold text-slate-700 dark:text-slate-200">{tx.customerName}</div>}
              {tx.note && <div>{tx.note}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => handleEdit(tx)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDeleteClick(tx.id, tx.transferGroupId)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400 italic">
            لا توجد حركات مطابقة للبحث أو الفلترة.
          </div>
        )}
      </div>

      {/* Delete Choice Dialog */}
      {deleteDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-200 rounded-full flex items-center justify-center mb-2">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">حذف حركة مرتبطة بتحويل</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                هذه الحركة جزء من عملية تحويل بين محفظتين. كيف ترغب في الحذف؟
              </p>
              
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={() => handleConfirmDelete('group')}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> حذف التحويل بالكامل (الطرفين)
                </button>
                <button 
                  onClick={() => handleConfirmDelete('single')}
                  className="w-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  حذف هذه الحركة فقط (فك الارتباط)
                </button>
                <button 
                  onClick={() => setDeleteDialog(null)}
                  className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 dark:hover:text-slate-200 pt-2"
                >
                  إلغاء الحذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <TransactionForm 
          onClose={() => {
            setIsFormOpen(false);
            setEditingTransaction(undefined);
          }} 
          onSuccess={() => {
            setIsFormOpen(false);
            setEditingTransaction(undefined);
            fetchTransactions();
          }}
          initialData={editingTransaction}
        />
      )}

      {/* Mobile action bar */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-lg flex items-center justify-between gap-2 px-3 py-2">
          <button
            onClick={() => setIsImportExportOpen(true)}
            className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={16} /> Import/Export
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            <Plus size={16} /> إضافة
          </button>
        </div>
      </div>

      {isImportExportOpen && (
        <ImportExportModal
          open={isImportExportOpen}
          onClose={() => setIsImportExportOpen(false)}
          transactions={transactions}
          filteredTransactions={filteredTransactions}
          onComplete={() => {
            setIsImportExportOpen(false);
            fetchTransactions();
          }}
        />
      )}
    </div>
  );
};
