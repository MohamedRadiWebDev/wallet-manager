import React, { useMemo, useState } from 'react';
import { X, FileSpreadsheet, UploadCloud, Download, AlertCircle, Filter, Calendar, Wallet as WalletIcon } from 'lucide-react';
import { Transaction, Wallet } from '../types';
import {
  applyImportRows,
  downloadTemplateXLSX,
  exportCSVZip,
  exportSummaryToCSV,
  exportTransactionsToCSV,
  exportTransactionsToXLSX,
  parseImportFile,
  ImportRowResult,
} from '../utils/importExport';
import { backupToJSON, restoreFromJSON } from '../utils/dataHandlers';

const WALLET_LABELS: Record<Wallet, string> = {
  [Wallet.VODAFONE]: 'فودافون كاش',
  [Wallet.ETISALAT]: 'اتصالات كاش',
  [Wallet.INSTAPAY]: 'انستا باي',
  [Wallet.FAWRY]: 'فوري',
};

interface Props {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  onComplete: () => void;
}

type ExportScope = 'all' | 'current' | 'range';

type ExportFormat = 'csv' | 'xlsx' | 'both';

type CsvMode = 'transactions' | 'zip';

export const ImportExportModal: React.FC<Props> = ({ open, onClose, transactions, filteredTransactions, onComplete }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'backup'>('export');
  const [exportScope, setExportScope] = useState<ExportScope>('current');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [csvMode, setCsvMode] = useState<CsvMode>('transactions');
  const [walletFilter, setWalletFilter] = useState<Wallet | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [previewRows, setPreviewRows] = useState<ImportRowResult[]>([]);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [hasParsed, setHasParsed] = useState(false);

  const exportSource = useMemo(() => {
    let base = exportScope === 'current' ? filteredTransactions : transactions;

    if (exportScope === 'range' && (dateFrom || dateTo)) {
      const fromDate = dateFrom ? new Date(dateFrom).getTime() : null;
      const toDate = dateTo ? new Date(dateTo).getTime() : null;
      base = base.filter((tx) => {
        const time = new Date(tx.date).getTime();
        if (fromDate && time < fromDate) return false;
        if (toDate && time > toDate) return false;
        return true;
      });
    }

    if (walletFilter !== 'all') {
      base = base.filter((tx) => tx.wallet === walletFilter);
    }

    return base;
  }, [exportScope, filteredTransactions, transactions, dateFrom, dateTo, walletFilter]);

  const invalidRows = previewRows.filter((row) => row.errors.length > 0);
  const validRows = previewRows.filter((row) => row.data);

  if (!open) return null;

  const handleExport = async () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const baseName = `wallet_export_${timestamp}`;

    if (exportFormat === 'xlsx' || exportFormat === 'both') {
      await exportTransactionsToXLSX(exportSource, `${baseName}.xlsx`);
    }

    if (exportFormat === 'csv') {
      if (csvMode === 'zip') {
        await exportCSVZip(exportSource, `${baseName}.zip`);
      } else {
        await exportTransactionsToCSV(exportSource, `${baseName}.csv`);
      }
    }

    if (exportFormat === 'both') {
      if (csvMode === 'zip') {
        await exportCSVZip(exportSource, `${baseName}.zip`);
      } else {
        await exportTransactionsToCSV(exportSource, `${baseName}.csv`);
        await exportSummaryToCSV(exportSource, `${baseName}_summary.csv`);
      }
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setIsParsing(true);
    setHasParsed(false);
    const result = await parseImportFile(file);
    setPreviewRows(result.rows);
    setHeaderErrors(result.headerErrors);
    setIsParsing(false);
    setHasParsed(true);
  };

  const handleImport = async (mode: 'valid' | 'all') => {
    if (mode === 'all' && invalidRows.length > 0) {
      alert('لا يمكن الاستيراد بسبب وجود صفوف غير صالحة.');
      return;
    }

    const count = await applyImportRows(mode === 'valid' ? validRows : previewRows);
    alert(`تم استيراد ${count} حركة بنجاح.`);
    onComplete();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) restoreFromJSON(file, onComplete);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-200 p-2 rounded-xl">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Import / Export Excel</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">تم تصميمه ليطابق قالب الإكسيل حرفياً.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all">
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          {([
            { id: 'export', label: 'Export' },
            { id: 'import', label: 'Import' },
            { id: 'backup', label: 'Backup' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="mr-auto">
            <button
              onClick={downloadTemplateXLSX}
              className="px-4 py-2 rounded-full text-sm font-bold bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-200 flex items-center gap-2"
            >
              <Download size={16} /> تحميل قالب الإكسيل
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm">
                    <Filter size={16} /> نطاق التصدير
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input type="radio" checked={exportScope === 'current'} onChange={() => setExportScope('current')} />
                      العرض الحالي
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input type="radio" checked={exportScope === 'all'} onChange={() => setExportScope('all')} />
                      كل الحركات
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input type="radio" checked={exportScope === 'range'} onChange={() => setExportScope('range')} />
                      نطاق تاريخي
                    </label>
                  </div>
                  {exportScope === 'range' && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Calendar size={14} /> من
                      </div>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Calendar size={14} /> إلى
                      </div>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm">
                    <WalletIcon size={16} /> تصفية حسب المصدر
                  </div>
                  <select
                    value={walletFilter}
                    onChange={(e) => setWalletFilter(e.target.value as Wallet | 'all')}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="all">كل المصادر</option>
                    {Object.values(Wallet).map((wallet) => (
                      <option key={wallet} value={wallet}>
                        {WALLET_LABELS[wallet]}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    سيتم تطبيق الفلاتر على التصدير.
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm">
                    <Download size={16} /> صيغة التصدير
                  </div>
                  <div className="space-y-2 text-sm">
                    {([
                      { value: 'xlsx', label: 'XLSX (Sheetين)' },
                      { value: 'csv', label: 'CSV' },
                      { value: 'both', label: 'XLSX + CSV' },
                    ] as const).map((option) => (
                      <label key={option.value} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <input
                          type="radio"
                          checked={exportFormat === option.value}
                          onChange={() => setExportFormat(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  {exportFormat !== 'xlsx' && (
                    <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={csvMode === 'transactions'}
                          onChange={() => setCsvMode('transactions')}
                        />
                        CSV للحركات فقط
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" checked={csvMode === 'zip'} onChange={() => setCsvMode('zip')} />
                        Export all (ZIP بالحركات + الملخص)
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">عدد الحركات المحددة للتصدير: {exportSource.length}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">سيتم إنشاء الأعمدة والتنسيقات طبقاً للقالب.</p>
                </div>
                <button
                  onClick={handleExport}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Download size={18} /> بدء التصدير
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold">
                  <UploadCloud size={18} /> رفع ملف الاستيراد
                </div>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {isParsing && <p className="text-xs text-slate-500">جاري قراءة الملف...</p>}
                {headerErrors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-200 p-3 rounded-xl border border-red-100 dark:border-red-500/20 text-sm">
                    {headerErrors.map((err) => (
                      <div key={err} className="flex items-center gap-2">
                        <AlertCircle size={14} /> {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {hasParsed && headerErrors.length === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                      <p className="text-xs text-slate-400">إجمالي الصفوف</p>
                      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{previewRows.length}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                      <p className="text-xs text-slate-400">الصفوف الصالحة</p>
                      <p className="text-2xl font-bold text-green-600">{validRows.length}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                      <p className="text-xs text-slate-400">الصفوف غير الصالحة</p>
                      <p className="text-2xl font-bold text-red-600">{invalidRows.length}</p>
                    </div>
                  </div>

                  {invalidRows.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4 space-y-2 max-h-48 overflow-y-auto">
                      {invalidRows.map((row) => (
                        <div key={row.rowNumber} className="text-sm text-red-600 dark:text-red-200">
                          الصف {row.rowNumber}: {row.errors.join('، ')}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-3">
                    <button
                      onClick={() => handleImport('valid')}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                    >
                      استيراد الصفوف الصحيحة فقط
                    </button>
                    <button
                      onClick={() => handleImport('all')}
                      className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-3 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      فشل الاستيراد عند وجود أخطاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">نسخة احتياطية سريعة</h4>
                <button
                  onClick={backupToJSON}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2"
                >
                  <Download size={16} /> تحميل نسخة احتياطية
                </button>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">استعادة نسخة احتياطية</h4>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <UploadCloud size={16} />
                  <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
                  اختر ملف النسخة الاحتياطية
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
