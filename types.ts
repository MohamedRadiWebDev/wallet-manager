
export enum Wallet {
  VODAFONE = 'VODAFONE',
  ETISALAT = 'ETISALAT',
  INSTAPAY = 'INSTAPAY',
  FAWRY = 'FAWRY'
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW'
}

export interface Transaction {
  id: string;
  createdAt: string;
  date: string;
  wallet: Wallet;
  type: TransactionType;
  amount: number;
  channel?: string;
  customerName?: string;
  accountNumber?: string;
  employee?: string;
  note?: string;
  transferTo?: Wallet | null;
  transferGroupId?: string | null;
}

export interface Settings {
  id: 'main';
  openingBalances: Record<Wallet, number>;
}

export interface WalletStats {
  wallet: Wallet;
  balance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  transactionCount: number;
}
