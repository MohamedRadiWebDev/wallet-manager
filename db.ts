
import { Dexie, Table } from 'dexie';
import { Transaction, Settings, Wallet } from './types';

export class MyDatabase extends Dexie {
  transactions!: Table<Transaction>;
  settings!: Table<Settings>;

  constructor() {
    super('WalletManagerDB');
    // Fix: Cast this to any to access the version method inherited from Dexie when type inference fails
    (this as any).version(1).stores({
      transactions: 'id, date, wallet, type, transferGroupId',
      settings: 'id'
    });
  }
}

export const db = new MyDatabase();

// Initialize default settings if not exists
export async function initSettings() {
  const existing = await db.settings.get('main');
  if (!existing) {
    await db.settings.add({
      id: 'main',
      openingBalances: {
        [Wallet.VODAFONE]: 0,
        [Wallet.ETISALAT]: 0,
        [Wallet.INSTAPAY]: 0,
        [Wallet.FAWRY]: 0
      }
    });
  }
}
