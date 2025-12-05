import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, Coin, CexConfig, Wallet, FiatTransaction, Transaction } from '../types';
import {
    demoTransactions,
    demoManualAssets,
    demoWallets,
    demoCexData,
    demoMonitoredCoins,
    demoTags
} from '../data/demoData';
import { v4 as uuidv4 } from 'uuid';

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            // Price Monitor
            monitoredCoins: [
                { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
                { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
                { id: 'solana', symbol: 'SOL', name: 'Solana' },
            ],
            prices: {},
            addMonitoredCoin: (coin) =>
                set((state) => {
                    if (state.monitoredCoins.some(c => c.id === coin.id)) return state;
                    return { monitoredCoins: [...state.monitoredCoins, coin] };
                }),
            removeMonitoredCoin: (coinId) =>
                set((state) => ({
                    monitoredCoins: state.monitoredCoins.filter((c) => c.id !== coinId),
                })),
            updatePrices: (newPrices) =>
                set((state) => ({ prices: { ...state.prices, ...newPrices } })),

            // CEX
            cexConfigs: [],
            cexData: null,
            addCexConfig: (config) =>
                set((state) => ({ cexConfigs: [...state.cexConfigs, config] })),
            removeCexConfig: (id) =>
                set((state) => ({
                    cexConfigs: state.cexConfigs.filter((c) => c.id !== id),
                })),
            updateCexConfig: (id, config) =>
                set((state) => ({
                    cexConfigs: state.cexConfigs.map((c) =>
                        c.id === id ? { ...c, ...config } : c
                    ),
                })),
            setCexData: (data) => set({ cexData: data }),
            cexExchangeOrder: [],
            setCexExchangeOrder: (order) => set({ cexExchangeOrder: order }),


            // Wallets
            wallets: [],
            addWallet: (wallet) =>
                set((state) => ({ wallets: [...state.wallets, wallet] })),
            removeWallet: (id) =>
                set((state) => ({ wallets: state.wallets.filter((w) => w.id !== id) })),
            updateWallet: (id, wallet) =>
                set((state) => ({
                    wallets: state.wallets.map((w) =>
                        w.id === id ? { ...w, ...wallet } : w
                    ),
                })),

            // Tags
            tags: [],
            addTag: (tag) =>
                set((state) => {
                    if (state.tags.includes(tag)) return state;
                    return { tags: [...state.tags, tag] };
                }),
            removeTag: (tag) =>
                set((state) => ({ tags: state.tags.filter((t) => t !== tag) })),

            // Fiat Ledger
            fiatTransactions: [],
            addFiatTransaction: (tx) =>
                set((state) => ({
                    fiatTransactions: [...state.fiatTransactions, tx],
                })),
            removeFiatTransaction: (id) =>
                set((state) => ({
                    fiatTransactions: state.fiatTransactions.filter((t) => t.id !== id),
                })),
            updateFiatTransaction: (id, tx) =>
                set((state) => ({
                    fiatTransactions: state.fiatTransactions.map((t) =>
                        t.id === id ? { ...t, ...tx } : t
                    ),
                })),

            // Transactions
            transactions: [],
            addTransaction: (tx) =>
                set((state) => ({ transactions: [...state.transactions, tx] })),
            removeTransaction: (id) =>
                set((state) => ({
                    transactions: state.transactions.map((t) =>
                        t.id === id ? { ...t, isDeleted: true } : t
                    ),
                })),
            restoreTransaction: (id) =>
                set((state) => ({
                    transactions: state.transactions.map((t) =>
                        t.id === id ? { ...t, isDeleted: false } : t
                    ),
                })),
            permanentlyDeleteTransaction: (id) =>
                set((state) => ({
                    transactions: state.transactions.filter((t) => t.id !== id),
                })),
            updateTransaction: (id, tx) =>
                set((state) => ({
                    transactions: state.transactions.map((t) =>
                        t.id === id ? { ...t, ...tx } : t
                    ),
                })),

            // UI Persistence
            activeTab: 'monitor',
            setActiveTab: (tab) => set({ activeTab: tab }),
            walletData: null,
            setWalletData: (data) => set((state) => ({
                walletData: typeof data === 'function' ? data(state.walletData) : data
            })),
            hideAmounts: false,
            toggleHideAmounts: () => set((state) => ({ hideAmounts: !state.hideAmounts })),

            // AI Config
            aiConfig: {
                apiKey: '',
                provider: 'openai',
                baseUrl: '',
                model: ''
            },
            setAiConfig: (config) => set((state) => ({ aiConfig: { ...state.aiConfig, ...config } })),

            // Earn Products
            earnProducts: [],
            setEarnProducts: (products) => set({ earnProducts: products }),
            showHeldOnly: false,
            toggleShowHeldOnly: () => set((state) => ({ showHeldOnly: !state.showHeldOnly })),

            // Manual Assets
            manualAssets: [],
            addManualAsset: (asset) => set((state) => ({
                manualAssets: [
                    ...state.manualAssets,
                    {
                        ...asset,
                        id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    }
                ]
            })),
            updateManualAsset: (id, updates) => set((state) => ({
                manualAssets: state.manualAssets.map(asset =>
                    asset.id === id
                        ? { ...asset, ...updates, updatedAt: Date.now() }
                        : asset
                )
            })),
            removeManualAsset: (id) => set((state) => ({
                manualAssets: state.manualAssets.filter(asset => asset.id !== id)
            })),


            // Data Backup & Restore
            exportData: () => {
                const state = useStore.getState();
                const backup = {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    data: {
                        cexConfigs: state.cexConfigs,
                        transactions: state.transactions,
                        fiatTransactions: state.fiatTransactions,
                        monitoredCoins: state.monitoredCoins,
                        wallets: state.wallets,
                        tags: state.tags,
                        aiConfig: state.aiConfig,
                        cexExchangeOrder: state.cexExchangeOrder,
                    }
                };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `crypto-bookkeeper-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            },

            importData: (jsonData: string) => {
                try {
                    const backup = JSON.parse(jsonData);
                    if (!backup.version || !backup.data) {
                        throw new Error('Invalid backup format');
                    }
                    set({
                        cexConfigs: backup.data.cexConfigs || [],
                        transactions: backup.data.transactions || [],
                        fiatTransactions: backup.data.fiatTransactions || [],
                        monitoredCoins: backup.data.monitoredCoins || [],
                        wallets: backup.data.wallets || [],
                        tags: backup.data.tags || [],
                        aiConfig: backup.data.aiConfig || { apiKey: '', provider: 'openai', baseUrl: '', model: '' },
                        cexExchangeOrder: backup.data.cexExchangeOrder || [],
                    });
                    return true;
                } catch (error) {
                    console.error('Import failed:', error);
                    return false;
                }
            },
        }),
        {
            name: 'crypto-bookkeeper-storage',
            onRehydrateStorage: () => (state) => {
                // Load demo data only if this is the first launch (no data in localStorage)
                if (state && state.transactions.length === 0 && state.wallets.length === 0) {
                    console.log('🎨 Loading demo data for first-time users...');

                    // Set demo transactions
                    state.transactions = demoTransactions;

                    // Set demo manual assets with IDs and timestamps
                    state.manualAssets = demoManualAssets.map(asset => ({
                        ...asset,
                        id: uuidv4(),
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }));

                    // Set demo wallets with IDs
                    state.wallets = demoWallets.map(wallet => ({
                        ...wallet,
                        id: uuidv4()
                    }));

                    // Set demo CEX data
                    state.cexData = demoCexData;
                    state.cexExchangeOrder = ['demo-bybit', 'demo-okx'];

                    // Set demo monitored coins
                    state.monitoredCoins = demoMonitoredCoins;

                    // Set demo tags
                    state.tags = demoTags;
                }
            }
        }
    )
);
