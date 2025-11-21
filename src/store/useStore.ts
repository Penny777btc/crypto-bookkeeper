import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, Coin, CexConfig, Wallet, FiatTransaction, Transaction } from '../types';

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
                    transactions: state.transactions.filter((t) => t.id !== id),
                })),
            updateTransaction: (id, tx) =>
                set((state) => ({
                    transactions: state.transactions.map((t) =>
                        t.id === id ? { ...t, ...tx } : t
                    ),
                })),
        }),
        {
            name: 'crypto-bookkeeper-storage',
        }
    )
);
