import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { Transaction, TransactionType, Wallet, Settings } from '../types';
import { db } from '../db';

export const TRANSACTION_HEADERS = [
  'رقم',
  'التاريخ',
  'المصدر',
  'نوع العملية',
  'المبلغ',
  'نوع الإيداع/القناة',
  'اسم العميل',
  'رقم الحساب',
  'الموظف',
  'البيان/ملاحظات',
  'الرصيد التراكمي للمصدر',
  'تحويل إلى',
];

export const SUMMARY_HEADERS = [
  'المصدر',
  'رصيد افتتاحي',
  'إجمالي الإيداعات',
  'إجمالي السحوبات',
  'الرصيد الحالي',
];

const WALLET_LABELS: Record<Wallet, string> = {
  [Wallet.VODAFONE]: 'فودافون كاش',
  [Wallet.ETISALAT]: 'اتصالات كاش',
  [Wallet.INSTAPAY]: 'انستا باي',
  [Wallet.FAWRY]: 'فوري',
};

const WALLET_ALIASES: Record<string, Wallet> = {
  'فودافون': Wallet.VODAFONE,
  'فودافونكاش': Wallet.VODAFONE,
  'فودافون كاش': Wallet.VODAFONE,
  'vodafone': Wallet.VODAFONE,
  'اتصالات': Wallet.ETISALAT,
  'اتصالاتكاش': Wallet.ETISALAT,
  'اتصالات كاش': Wallet.ETISALAT,
  'etisalat': Wallet.ETISALAT,
  'انستا باي': Wallet.INSTAPAY,
  'انستاباي': Wallet.INSTAPAY,
  'instapay': Wallet.INSTAPAY,
  'فوري': Wallet.FAWRY,
  'fawry': Wallet.FAWRY,
};

const TYPE_ALIASES: Record<string, TransactionType> = {
  'ايداع': TransactionType.DEPOSIT,
  'إيداع': TransactionType.DEPOSIT,
  'deposit': TransactionType.DEPOSIT,
  'سحب': TransactionType.WITHDRAW,
  'withdraw': TransactionType.WITHDRAW,
};

const normalizeHeader = (value: string) => value.replace(/\s+/g, '').trim();

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const parseWallet = (value: string) => WALLET_ALIASES[normalizeText(value).toLowerCase()] || null;

const parseType = (value: string) => TYPE_ALIASES[normalizeText(value).toLowerCase()] || null;

const formatDateString = (value: Date) => {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatISODate = (value: Date) => value.toISOString().split('T')[0];

const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/[\/\-]/);
    if (parts.length === 3) {
      const [first, second, third] = parts;
      if (first.length === 4) {
        const year = parseInt(first, 10);
        const month = parseInt(second, 10);
        const day = parseInt(third, 10);
        if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
          return new Date(year, month - 1, day);
        }
      } else {
        const day = parseInt(first, 10);
        const month = parseInt(second, 10);
        const year = parseInt(third, 10);
        if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
          return new Date(year, month - 1, day);
        }
      }
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
};

const buildSortableDate = (date: string) => {
  const parsed = parseDateValue(date);
  return parsed ? parsed.getTime() : 0;
};

const getSettings = async (): Promise<Settings> => {
  const settings = await db.settings.get('main');
  return (
    settings || {
      id: 'main',
      openingBalances: {
        [Wallet.VODAFONE]: 0,
        [Wallet.ETISALAT]: 0,
        [Wallet.INSTAPAY]: 0,
        [Wallet.FAWRY]: 0,
      },
    }
  );
};

const computeSummary = (transactions: Transaction[], settings: Settings) => {
  return Object.values(Wallet).map((wallet) => {
    const walletTx = transactions.filter((t) => t.wallet === wallet);
    const deposits = walletTx
      .filter((t) => t.type === TransactionType.DEPOSIT)
      .reduce((acc, t) => acc + t.amount, 0);
    const withdrawals = walletTx
      .filter((t) => t.type === TransactionType.WITHDRAW)
      .reduce((acc, t) => acc + t.amount, 0);
    const opening = settings.openingBalances[wallet] || 0;
    const balance = opening + deposits - withdrawals;
    return [WALLET_LABELS[wallet], opening, deposits, withdrawals, balance];
  });
};

const computeRunningBalances = (transactions: Transaction[], settings: Settings) => {
  const running: Record<Wallet, number> = { ...settings.openingBalances } as Record<Wallet, number>;
  return transactions.map((tx) => {
    if (tx.type === TransactionType.DEPOSIT) {
      running[tx.wallet] += tx.amount;
    } else {
      running[tx.wallet] -= tx.amount;
    }
    return running[tx.wallet];
  });
};

export const exportTransactionsToCSV = async (transactions: Transaction[], filename: string) => {
  const settings = await getSettings();
  const sorted = [...transactions].sort((a, b) => buildSortableDate(a.date) - buildSortableDate(b.date));
  const runningBalances = computeRunningBalances(sorted, settings);

  const rows = sorted.map((t, index) => [
    index + 1,
    formatDateString(parseDateValue(t.date) || new Date(t.date)),
    WALLET_LABELS[t.wallet],
    t.type === TransactionType.DEPOSIT ? 'إيداع' : 'سحب',
    t.amount.toFixed(2),
    t.channel || '',
    t.customerName || '',
    t.accountNumber || '',
    t.employee || '',
    t.note || '',
    runningBalances[index]?.toFixed(2) ?? '',
    t.transferTo ? WALLET_LABELS[t.transferTo] : '',
  ]);

  const csvContent = "\uFEFF" + [TRANSACTION_HEADERS, ...rows].map((row) => row.join(',')).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
};

export const exportSummaryToCSV = async (transactions: Transaction[], filename: string) => {
  const settings = await getSettings();
  const rows = computeSummary(transactions, settings);
  const csvContent = "\uFEFF" + [SUMMARY_HEADERS, ...rows].map((row) => row.join(',')).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
};

export const exportCSVZip = async (transactions: Transaction[], filename: string) => {
  const settings = await getSettings();
  const sorted = [...transactions].sort((a, b) => buildSortableDate(a.date) - buildSortableDate(b.date));
  const runningBalances = computeRunningBalances(sorted, settings);
  const rows = sorted.map((t, index) => [
    index + 1,
    formatDateString(parseDateValue(t.date) || new Date(t.date)),
    WALLET_LABELS[t.wallet],
    t.type === TransactionType.DEPOSIT ? 'إيداع' : 'سحب',
    t.amount.toFixed(2),
    t.channel || '',
    t.customerName || '',
    t.accountNumber || '',
    t.employee || '',
    t.note || '',
    runningBalances[index]?.toFixed(2) ?? '',
    t.transferTo ? WALLET_LABELS[t.transferTo] : '',
  ]);

  const summary = computeSummary(transactions, settings);
  const zip = new JSZip();
  zip.file('الحركات.csv', "\uFEFF" + [TRANSACTION_HEADERS, ...rows].map((row) => row.join(',')).join("\n"));
  zip.file('الملخص.csv', "\uFEFF" + [SUMMARY_HEADERS, ...summary].map((row) => row.join(',')).join("\n"));
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
};

export const exportTransactionsToXLSX = async (transactions: Transaction[], filename: string) => {
  const settings = await getSettings();
  const sorted = [...transactions].sort((a, b) => buildSortableDate(a.date) - buildSortableDate(b.date));
  const runningBalances = computeRunningBalances(sorted, settings);

  const rows = sorted.map((t, index) => [
    index + 1,
    parseDateValue(t.date) || new Date(t.date),
    WALLET_LABELS[t.wallet],
    t.type === TransactionType.DEPOSIT ? 'إيداع' : 'سحب',
    t.amount,
    t.channel || '',
    t.customerName || '',
    t.accountNumber || '',
    t.employee || '',
    t.note || '',
    runningBalances[index] ?? '',
    t.transferTo ? WALLET_LABELS[t.transferTo] : '',
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([TRANSACTION_HEADERS, ...rows], { cellDates: true });
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 26 },
    { wch: 20 },
    { wch: 16 },
  ];
  worksheet['!autofilter'] = { ref: `A1:L1` };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  worksheet['!views'] = [{ rightToLeft: true }];

  rows.forEach((_, index) => {
    const dateCell = worksheet[`B${index + 2}`];
    if (dateCell) {
      dateCell.z = 'dd/mm/yyyy';
    }
    const amountCell = worksheet[`E${index + 2}`];
    if (amountCell) {
      amountCell.z = '#,##0.00';
    }
    const balanceCell = worksheet[`K${index + 2}`];
    if (balanceCell) {
      balanceCell.z = '#,##0.00';
    }
  });

  const summaryRows = computeSummary(transactions, settings);
  const summarySheet = XLSX.utils.aoa_to_sheet([SUMMARY_HEADERS, ...summaryRows]);
  summarySheet['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
  ];
  summarySheet['!autofilter'] = { ref: `A1:E1` };
  summarySheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  summarySheet['!views'] = [{ rightToLeft: true }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الحركات');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'الملخص');

  XLSX.writeFile(workbook, filename, { bookType: 'xlsx' });
};

export const downloadTemplateXLSX = () => {
  const worksheet = XLSX.utils.aoa_to_sheet([TRANSACTION_HEADERS]);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 26 },
    { wch: 20 },
    { wch: 16 },
  ];
  worksheet['!autofilter'] = { ref: `A1:L1` };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  worksheet['!views'] = [{ rightToLeft: true }];

  const summarySheet = XLSX.utils.aoa_to_sheet([SUMMARY_HEADERS]);
  summarySheet['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
  ];
  summarySheet['!autofilter'] = { ref: `A1:E1` };
  summarySheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  summarySheet['!views'] = [{ rightToLeft: true }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الحركات');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'الملخص');
  XLSX.writeFile(workbook, 'wallet_template.xlsx', { bookType: 'xlsx' });
};

export type ImportRowData = {
  date: Date;
  wallet: Wallet;
  type: TransactionType;
  amount: number;
  channel?: string;
  customerName?: string;
  accountNumber?: string;
  employee?: string;
  note?: string;
  transferTo?: Wallet | null;
};

export type ImportRowResult = {
  rowNumber: number;
  data?: ImportRowData;
  errors: string[];
};

const buildRowData = (row: Record<string, unknown>, rowNumber: number): ImportRowResult => {
  const errors: string[] = [];
  const dateValue = parseDateValue(row['التاريخ']);
  if (!dateValue) errors.push('تاريخ غير صالح');

  const wallet = typeof row['المصدر'] === 'string' ? parseWallet(row['المصدر']) : null;
  if (!wallet) errors.push('مصدر غير صالح');

  const type = typeof row['نوع العملية'] === 'string' ? parseType(row['نوع العملية']) : null;
  if (!type) errors.push('نوع العملية غير صالح');

  const amountValue = typeof row['المبلغ'] === 'number' ? row['المبلغ'] : parseFloat(String(row['المبلغ'] ?? ''));
  if (!amountValue || amountValue <= 0) errors.push('المبلغ يجب أن يكون رقم أكبر من صفر');

  const transferToValue = typeof row['تحويل إلى'] === 'string' && row['تحويل إلى'].trim()
    ? parseWallet(row['تحويل إلى'])
    : null;
  if (row['تحويل إلى'] && !transferToValue) {
    errors.push('تحويل إلى غير صالح');
  }

  if (errors.length > 0) {
    return { rowNumber, errors };
  }

  return {
    rowNumber,
    errors,
    data: {
      date: dateValue!,
      wallet: wallet!,
      type: type!,
      amount: Number(amountValue),
      channel: typeof row['نوع الإيداع/القناة'] === 'string' ? row['نوع الإيداع/القناة'] : '',
      customerName: typeof row['اسم العميل'] === 'string' ? row['اسم العميل'] : '',
      accountNumber: typeof row['رقم الحساب'] === 'string' ? row['رقم الحساب'] : '',
      employee: typeof row['الموظف'] === 'string' ? row['الموظف'] : '',
      note: typeof row['البيان/ملاحظات'] === 'string' ? row['البيان/ملاحظات'] : '',
      transferTo: transferToValue || null,
    },
  };
};

const validateHeaders = (headers: string[]) => {
  const normalizedHeaders = headers.map(normalizeHeader);
  const required = TRANSACTION_HEADERS.map(normalizeHeader);
  const missing = required.filter((header) => !normalizedHeaders.includes(header));
  return missing;
};

export const parseImportFile = async (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx') {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets['الحركات'];
    if (!sheet) {
      return { rows: [] as ImportRowResult[], headerErrors: ['Sheet "الحركات" غير موجود'] };
    }

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number | Date)[][];
    const headers = rawRows[0]?.map((h) => String(h)) || [];
    const missing = validateHeaders(headers);
    if (missing.length > 0) {
      return { rows: [] as ImportRowResult[], headerErrors: [`أعمدة مفقودة: ${missing.join('، ')}`] };
    }

    const headerMap = headers.reduce<Record<string, number>>((acc, header, index) => {
      acc[normalizeHeader(header)] = index;
      return acc;
    }, {});

    const rows = rawRows.slice(1).map((row, index) => {
      const mapped: Record<string, unknown> = {};
      TRANSACTION_HEADERS.forEach((header) => {
        const idx = headerMap[normalizeHeader(header)];
        mapped[header] = row[idx];
      });
      return buildRowData(mapped, index + 2);
    });

    return { rows, headerErrors: [] };
  }

  return new Promise<{ rows: ImportRowResult[]; headerErrors: string[] }>((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const missing = validateHeaders(headers);
        if (missing.length > 0) {
          resolve({ rows: [], headerErrors: [`أعمدة مفقودة: ${missing.join('، ')}`] });
          return;
        }

        const headerMap = headers.reduce<Record<string, string>>((acc, header) => {
          acc[normalizeHeader(header)] = header;
          return acc;
        }, {});

        const rows = results.data.map((row, index) => {
          const mapped: Record<string, unknown> = {};
          TRANSACTION_HEADERS.forEach((header) => {
            const original = headerMap[normalizeHeader(header)];
            mapped[header] = original ? row[original] : '';
          });
          return buildRowData(mapped, index + 2);
        });
        resolve({ rows, headerErrors: [] });
      },
      error: () => {
        resolve({ rows: [], headerErrors: ['فشل في قراءة ملف CSV'] });
      },
    });
  });
};

export const applyImportRows = async (rows: ImportRowResult[]) => {
  const validRows = rows.filter((row) => row.data);
  const used = new Set<number>();
  const now = new Date().toISOString();
  const transactions: Transaction[] = [];

  const rowData = validRows.map((row) => row.data!).map((data, index) => ({ data, index }));

  rowData.forEach(({ data, index }) => {
    if (used.has(index)) return;

    if (data.type === TransactionType.WITHDRAW && data.transferTo) {
      const matchIndex = rowData.findIndex((candidate, candidateIndex) => {
        if (used.has(candidateIndex) || candidateIndex === index) return false;
        return (
          candidate.data.type === TransactionType.DEPOSIT &&
          candidate.data.wallet === data.transferTo &&
          candidate.data.amount === data.amount &&
          candidate.data.date.toDateString() === data.date.toDateString()
        );
      });

      const transferGroupId = crypto.randomUUID();
      transactions.push({
        id: crypto.randomUUID(),
        createdAt: now,
        date: formatISODate(data.date),
        wallet: data.wallet,
        type: data.type,
        amount: data.amount,
        channel: data.channel,
        customerName: data.customerName,
        accountNumber: data.accountNumber,
        employee: data.employee,
        note: data.note,
        transferTo: data.transferTo,
        transferGroupId,
      });

      if (matchIndex >= 0) {
        used.add(matchIndex);
        const matched = rowData[matchIndex].data;
        transactions.push({
          id: crypto.randomUUID(),
          createdAt: now,
          date: formatISODate(matched.date),
          wallet: matched.wallet,
          type: matched.type,
          amount: matched.amount,
          channel: matched.channel,
          customerName: matched.customerName,
          accountNumber: matched.accountNumber,
          employee: matched.employee,
          note: matched.note,
          transferGroupId,
        });
      } else {
        transactions.push({
          id: crypto.randomUUID(),
          createdAt: now,
          date: formatISODate(data.date),
          wallet: data.transferTo,
          type: TransactionType.DEPOSIT,
          amount: data.amount,
          channel: data.channel,
          customerName: data.customerName,
          accountNumber: data.accountNumber,
          employee: data.employee,
          note: `تحويل من ${WALLET_LABELS[data.wallet]}${data.note ? `: ${data.note}` : ''}`,
          transferGroupId,
        });
      }

      return;
    }

    transactions.push({
      id: crypto.randomUUID(),
      createdAt: now,
      date: formatISODate(data.date),
      wallet: data.wallet,
      type: data.type,
      amount: data.amount,
      channel: data.channel,
      customerName: data.customerName,
      accountNumber: data.accountNumber,
      employee: data.employee,
      note: data.note,
    });
  });

  if (transactions.length > 0) {
    await db.transactions.bulkAdd(transactions);
  }

  return transactions.length;
};
