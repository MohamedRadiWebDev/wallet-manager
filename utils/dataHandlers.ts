
import { db } from '../db';

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
