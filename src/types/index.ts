export interface Coin {
    id: string;
    symbol: string;
    name: string;
    image?: string;
    current_price?: number;
    price_change_percentage_24h?: number;
    sparkline_in_7d?: { price: number[] };
}

export interface CexConfig {
    id: string;
    platformId: string;
    apiKey: string;
    apiSecret: string;
    password?: string; // For exchanges like OKX that require a passphrase
    name?: string; // User defined name
    makerFeeRate?: number; // Maker fee rate in percentage
    takerFeeRate?: number; // Taker fee rate in percentage
    enabled?: boolean; // Whether to fetch data for this config
}

export interface Wallet {
    id: string;
    name: string;
    chainType: 'evm' | 'solana' | 'bitcoin' | 'sui' | string; // Changed from 'chain'
    address: string;
    chains?: string[]; // For EVM, list of specific chains to scan (e.g. ['ethereum', 'arbitrum'])
    tags: string[];
    // Legacy support (optional)
    chain?: string;
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
    pnl?: number;
    intent?: string; // Long, Short, etc.
    notes?: string;
    link?: string;
    relatedTransactionId?: string;
    fills?: { price: number; amount: number; date: string }[];
    isDeleted?: boolean;
}

export interface CoinMetadata {
    id: string;
    symbol: string;
    name: string;
    image?: string;
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
    cexExchangeOrder: string[]; // Array of exchange IDs in display order
    setCexExchangeOrder: (order: string[]) => void;


    // Wallets
    wallets: Wallet[];
    addWallet: (wallet: Wallet) => void;
    removeWallet: (id: string) => void;
    updateWallet: (id: string, wallet: Partial<Wallet>) => void;

    // Tags
    tags: string[];
    addTag: (tag: string) => void;
    removeTag: (tag: string) => void;

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
    restoreTransaction: (id: string) => void;
    permanentlyDeleteTransaction: (id: string) => void;

    // UI Persistence
    activeTab: string;
    setActiveTab: (tab: string) => void;
    walletData: any;
    setWalletData: (data: any) => void;
    hideAmounts: boolean;
    toggleHideAmounts: () => void;

    // AI Config
    aiConfig: {
        apiKey: string;
        provider: 'openai' | 'gemini' | 'claude' | 'custom';
        baseUrl?: string;
        model?: string;
    };
    setAiConfig: (config: Partial<AppState['aiConfig']>) => void;

    // Earn Products
    earnProducts: PlatformProducts[];
    setEarnProducts: (products: PlatformProducts[]) => void;
    showHeldOnly: boolean;
    toggleShowHeldOnly: () => void;

    // Manual Assets
    manualAssets: ManualAsset[];
    addManualAsset: (asset: Omit<ManualAsset, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateManualAsset: (id: string, updates: Partial<ManualAsset>) => void;
    removeManualAsset: (id: string) => void;

    // Data Backup & Restore
    exportData: () => void;
    importData: (jsonData: string) => boolean;
}

export interface ManualAsset {
    id: string;
    exchange: string;
    symbol: string;
    amount: number;
    note?: string;
    createdAt: number;
    updatedAt: number;
}

export interface EarnProduct {
    asset: string;
    type: 'flexible' | 'locked';
    apr: number;
    dailyRate: number;
    canPurchase: boolean;
    minAmount: number | null;
    maxAmount: number | null;
}

export interface PlatformProducts {
    platform: string;
    platformId: string;
    products: EarnProduct[];
}
