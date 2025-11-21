export interface Coin {
    id: string;
    symbol: string;
    name: string;
    current_price?: number;
    price_change_percentage_24h?: number;
}

export interface CexConfig {
    id: string;
    platformId: string;
    apiKey: string;
    apiSecret: string;
    name?: string; // User defined name
}

export interface Wallet {
    id: string;
    name: string;
    chain: string;
    address: string;
}

export interface FiatTransaction {
    id: string;
    date: string; // ISO string
    type: 'Deposit' | 'Withdraw';
    currency: string;
    amount: number;
    platform: string;
    notes?: string;
}

export interface Transaction {
    id: string;
    date: string; // ISO string
    type: string; // Buy, Sell, etc.
    platform: string;
    pair: string; // e.g., BTC/USDT
    amount: number;
    price: number;
    fee: number;
    apr?: number;
    intent?: string; // Long, Short, etc.
    notes?: string;
}

export interface CoinMetadata {
    id: string;
    symbol: string;
    name: string;
}

export interface AppState {
    // Price Monitor
    monitoredCoins: CoinMetadata[]; // List of coin metadata
    prices: Record<string, Coin>; // Cache of prices
    addMonitoredCoin: (coin: CoinMetadata) => void;
    removeMonitoredCoin: (coinId: string) => void;
    updatePrices: (prices: Record<string, Coin>) => void;

    // CEX
    cexConfigs: CexConfig[];
    cexData: any; // Using any for flexibility with the new backend structure
    addCexConfig: (config: CexConfig) => void;
    removeCexConfig: (id: string) => void;
    updateCexConfig: (id: string, config: Partial<CexConfig>) => void;
    setCexData: (data: any) => void;

    // Wallets
    wallets: Wallet[];
    addWallet: (wallet: Wallet) => void;
    removeWallet: (id: string) => void;
    updateWallet: (id: string, wallet: Partial<Wallet>) => void;

    // Fiat Ledger
    fiatTransactions: FiatTransaction[];
    addFiatTransaction: (tx: FiatTransaction) => void;
    removeFiatTransaction: (id: string) => void;
    updateFiatTransaction: (id: string, tx: Partial<FiatTransaction>) => void;

    // Transactions
    transactions: Transaction[];
    addTransaction: (tx: Transaction) => void;
    removeTransaction: (id: string) => void;
    updateTransaction: (id: string, tx: Partial<Transaction>) => void;
}
