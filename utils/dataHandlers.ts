
import { Transaction, Wallet, TransactionType, Settings } from '../types';
import { db } from '../db';

export const exportToCSV = (transactions: Transaction[], filename: string) => {
  const headers = ['ID', 'التاريخ', 'المحفظة', 'النوع', 'المبلغ', 'القناة', 'العميل', 'رقم الحساب', 'ملاحظات'];
  const rows = transactions.map(t => [
    t.id,
    t.date,
    t.wallet,
    t.type === TransactionType.DEPOSIT ? 'إيداع' : 'سحب',
    t.amount,
    t.channel || '',
    t.customerName || '',
    t.accountNumber || '',
    t.note || ''
  ]);

  const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
};

export const importFromCSV = async (file: File, onComplete: () => void) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target?.result as string;
    const lines = text.split("\n").slice(1); // skip headers
    const imports: Transaction[] = [];

    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 5) continue;

      imports.push({
        id: parts[0] || crypto.randomUUID(),
        date: parts[1] || new Date().toISOString().split('T')[0],
        wallet: (parts[2] as Wallet) || Wallet.VODAFONE,
        type: parts[3] === 'إيداع' ? TransactionType.DEPOSIT : TransactionType.WITHDRAW,
        amount: parseFloat(parts[4]) || 0,
        customerName: parts[6] || '',
        accountNumber: parts[7] || '',
        note: parts[8] || '',
        createdAt: new Date().toISOString(),
      });
    }

    if (imports.length > 0) {
      await db.transactions.bulkPut(imports);
      alert(`تم استيراد ${imports.length} حركة بنجاح.`);
      onComplete();
    }
  };
  reader.readAsText(file);
};

export const backupToJSON = async () => {
  const transactions = await db.transactions.toArray();
  const settings = await db.settings.get('main');
  
  const backup = {
    version: 1,
    date: new Date().toISOString(),
    transactions,
    settings
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `wallet_backup_${new Date().toISOString().split('T')[0]}.json`);
  link.click();
};

export const restoreFromJSON = async (file: File, onComplete: () => void) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (!data.transactions || !data.settings) throw new Error('تنسيق غير صالح');
      
      if (window.confirm('سيتم استبدال البيانات الحالية بالنسخة الاحتياطية. هل أنت متأكد؟')) {
        await db.transactions.clear();
        await db.transactions.bulkAdd(data.transactions);
        await db.settings.put(data.settings);
        alert('تمت استعادة البيانات بنجاح.');
        onComplete();
      }
    } catch (err) {
      alert('خطأ في استعادة النسخة الاحتياطية: ملف غير صالح.');
    }
  };
  reader.readAsText(file);
};
