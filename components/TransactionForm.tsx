
import React, { useState } from 'react';
import { db } from '../db';
import { Wallet, TransactionType, Transaction } from '../types';
import { X, Save, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Transaction;
}

export const TransactionForm: React.FC<Props> = ({ onClose, onSuccess, initialData }) => {
  const [formData, setFormData] = useState<Partial<Transaction>>(
    initialData || {
      date: new Date().toISOString().split('T')[0],
      wallet: Wallet.VODAFONE,
      type: TransactionType.DEPOSIT,
      amount: 0,
      note: '',
    }
  );

  const [errors, setErrors] = useState<string[]>([]);

  const validate = () => {
    const errs = [];
    if (!formData.amount || formData.amount <= 0) errs.push('يجب إدخال مبلغ أكبر من صفر');
    if (!formData.date) errs.push('التاريخ مطلوب');
    if (formData.type === TransactionType.WITHDRAW && formData.transferTo === formData.wallet) {
      errs.push('لا يمكن التحويل لنفس المحفظة');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const txId = initialData?.id || crypto.randomUUID();
      const createdAt = initialData?.createdAt || new Date().toISOString();
      
      const mainTx: Transaction = {
        ...(formData as Transaction),
        id: txId,
        createdAt,
      };

      // Smart Transfer Logic
      const isTransfer = mainTx.type === TransactionType.WITHDRAW && mainTx.transferTo;
      const transferGroupId = mainTx.transferGroupId || (isTransfer ? crypto.randomUUID() : null);
      mainTx.transferGroupId = transferGroupId;

      // Fix: Cast db to any to access the transaction method inherited from Dexie when TS fails to recognize it
      await (db as any).transaction('rw', db.transactions, async () => {
        // If editing and it WAS a transfer, cleanup previous buddy first
        if (initialData?.transferGroupId) {
          const buddy = await db.transactions
            .where('transferGroupId')
            .equals(initialData.transferGroupId)
            .and(t => t.id !== initialData.id)
            .first();
          if (buddy) await db.transactions.delete(buddy.id);
        }

        // Put main transaction
        await db.transactions.put(mainTx);

        // Create buddy transaction if needed
        if (isTransfer) {
          const buddyTx: Transaction = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            date: mainTx.date,
            wallet: mainTx.transferTo!,
            type: TransactionType.DEPOSIT,
            amount: mainTx.amount,
            note: `تحويل من ${mainTx.wallet}${mainTx.note ? ': ' + mainTx.note : ''}`,
            transferGroupId: transferGroupId,
            customerName: mainTx.customerName,
            accountNumber: mainTx.accountNumber,
          };
          await db.transactions.add(buddyTx);
        }
      });

      onSuccess();
    } catch (err) {
      console.error(err);
      setErrors(['حدث خطأ أثناء حفظ البيانات']);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-slideIn">
        <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{initialData ? 'تعديل حركة' : 'إضافة حركة جديدة'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-500/10 p-4 rounded-xl border border-red-100 dark:border-red-500/20 flex flex-col gap-1">
              {errors.map((e, i) => (
                <div key={i} className="text-red-600 dark:text-red-200 text-sm font-bold flex items-center gap-2">
                  <AlertCircle size={14} /> {e}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">التاريخ</label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-slate-700 dark:text-slate-200"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">المحفظة (المصدر)</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-slate-700 dark:text-slate-200"
                value={formData.wallet}
                onChange={(e) => setFormData({ ...formData, wallet: e.target.value as Wallet })}
              >
                {Object.values(Wallet).map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">نوع العملية</label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, type: TransactionType.DEPOSIT, transferTo: null })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === TransactionType.DEPOSIT ? 'bg-white dark:bg-slate-900 shadow-sm text-green-600' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  إيداع
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, type: TransactionType.WITHDRAW })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === TransactionType.WITHDRAW ? 'bg-white dark:bg-slate-900 shadow-sm text-red-500' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  سحب
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">المبلغ</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full pr-4 pl-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-bold text-lg text-slate-700 dark:text-slate-200"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">ج.م</span>
              </div>
            </div>

            {formData.type === TransactionType.WITHDRAW && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-200">تحويل إلى (اختياري)</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-slate-700 dark:text-slate-200"
                  value={formData.transferTo || ''}
                  onChange={(e) => setFormData({ ...formData, transferTo: (e.target.value as Wallet) || null })}
                >
                  <option value="">-- لا يوجد --</option>
                  {Object.values(Wallet).map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <p className="text-[10px] text-slate-400">سيتم إنشاء قيد إيداع تلقائي في المحفظة المختارة.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-50 dark:border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">اسم العميل / الموظف</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-slate-700 dark:text-slate-200"
                value={formData.customerName || ''}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">رقم الحساب</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-slate-700 dark:text-slate-200"
                value={formData.accountNumber || ''}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">ملاحظات إضافية</label>
            <textarea 
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all resize-none text-slate-700 dark:text-slate-200"
              rows={2}
              value={formData.note || ''}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            ></textarea>
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <Save size={20} /> حفظ البيانات
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 py-3 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
