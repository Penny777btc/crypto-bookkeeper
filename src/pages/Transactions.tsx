import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { TransactionList } from '../components/transactions/TransactionList';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { Transaction } from '../types';

export const Transactions: React.FC = () => {
    const { transactions, addTransaction, removeTransaction, updateTransaction, permanentlyDeleteTransaction } = useStore();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [relatedTx, setRelatedTx] = useState<Transaction | null>(null);

    const handleAdd = () => {
        setEditingTx(null);
        setRelatedTx(null);
        setView('form');
    };

    const handleEdit = (tx: Transaction) => {
        console.log('Editing transaction:', tx);
        setEditingTx(tx);
        if (tx.relatedTransactionId) {
            const related = transactions.find(t => t.id === tx.relatedTransactionId);
            console.log('Found related transaction:', related);
            setRelatedTx(related || null);
        } else {
            // Check if this is the sell side of a pair (less common entry point but possible)
            const parent = transactions.find(t => t.relatedTransactionId === tx.id);
            if (parent) {
                console.log('Found parent transaction:', parent);
                // If editing the sell side, we should probably switch to editing the buy side as primary
                setEditingTx(parent);
                setRelatedTx(tx);
            } else {
                console.log('No related transaction found');
                setRelatedTx(null);
            }
        }
        setView('form');
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this transaction pair?')) {
            const tx = transactions.find(t => t.id === id);
            removeTransaction(id);
            if (tx?.relatedTransactionId) {
                console.log('Deleting related transaction:', tx.relatedTransactionId);
                removeTransaction(tx.relatedTransactionId);
            }
            // Also check if this was a sell side and we deleted it, should we delete the parent buy?
            // In our new list logic, we pass the Buy ID for pairs, so the above covers it.
            // But for safety, if we somehow deleted a sell that had a parent:
            const parent = transactions.find(t => t.relatedTransactionId === id);
            if (parent) {
                console.log('Deleting parent transaction:', parent.id);
                removeTransaction(parent.id);
            }
        }
    };

    const handleSave = (txs: Transaction[]) => {
        console.log('Saving transactions:', txs);
        txs.forEach(tx => {
            const existing = transactions.find(t => t.id === tx.id);
            if (existing) {
                console.log('Updating existing:', tx);
                updateTransaction(tx.id, tx);
            } else {
                console.log('Adding new:', tx);
                addTransaction(tx);
            }
        });
        setView('list');
        setEditingTx(null);
        setRelatedTx(null);
    };

    const handleCancel = () => {
        setView('list');
        setEditingTx(null);
        setRelatedTx(null);
    };

    const handleImport = (txs: Transaction[]) => {
        // Group by pair for auto-pairing
        const buyMap = new Map<string, Transaction[]>();
        const sellMap = new Map<string, Transaction[]>();
        const standalone: Transaction[] = [];

        // Separate Buy and Sell transactions by pair
        txs.forEach(tx => {
            if (tx.type === 'Buy') {
                if (!buyMap.has(tx.pair)) buyMap.set(tx.pair, []);
                buyMap.get(tx.pair)!.push(tx);
            } else if (tx.type === 'Sell') {
                if (!sellMap.has(tx.pair)) sellMap.set(tx.pair, []);
                sellMap.get(tx.pair)!.push(tx);
            } else {
                standalone.push(tx);
            }
        });

        // Auto-pair Buy and Sell for the same pair
        const paired: Transaction[] = [];

        buyMap.forEach((buys, pair) => {
            const sells = sellMap.get(pair) || [];

            // Sort by date to match chronologically
            buys.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            sells.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Pair each buy with its corresponding sell
            for (let i = 0; i < Math.max(buys.length, sells.length); i++) {
                const buy = buys[i];
                const sell = sells[i];

                if (buy && sell) {
                    // Calculate PnL and APR
                    const buyValue = buy.amount * buy.price;
                    const sellValue = sell.amount * sell.price;
                    const pnl = sellValue - buyValue - buy.fee - sell.fee;

                    const buyDate = new Date(buy.date);
                    const sellDate = new Date(sell.date);
                    const daysHeld = (sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24);
                    const apr = daysHeld > 0 ? (pnl / buyValue) * (365 / daysHeld) * 100 : 0;

                    // Link transactions
                    buy.relatedTransactionId = sell.id;
                    sell.relatedTransactionId = buy.id;
                    sell.pnl = pnl;
                    sell.apr = apr;

                    paired.push(buy, sell);
                } else if (buy) {
                    // Only buy, no matching sell
                    paired.push(buy);
                } else if (sell) {
                    // Only sell, no matching buy
                    paired.push(sell);
                }
            }

            // Remove processed sells from map
            sellMap.delete(pair);
        });

        // Add any remaining sells (no matching buys)
        sellMap.forEach(sells => {
            paired.push(...sells);
        });

        // Add all paired + standalone transactions
        [...paired, ...standalone].forEach(tx => addTransaction(tx));
    };

    const handleCleanup = (id: string) => {
        console.log('Cleaning up invalid transaction:', id);
        removeTransaction(id);
    };

    return (
        <div className="container mx-auto py-6 max-w-7xl">
            {view === 'list' ? (
                <TransactionList
                    transactions={transactions}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAdd={handleAdd}
                    onImport={handleImport}
                />
            ) : (
                <TransactionForm
                    initialData={editingTx}
                    relatedData={relatedTx}
                    onSave={handleSave}
                    onDelete={handleCleanup}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};
