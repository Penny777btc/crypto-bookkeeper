import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { CONFIG } from '../config/config';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '../components/ui';
import { formatCurrency } from '../utils/utils';
import { Trash2, Plus, Filter, ArrowRightLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export const Transactions: React.FC = () => {
    const { transactions, addTransaction, removeTransaction } = useStore();

    // Filters
    const [filterCoin, setFilterCoin] = useState('');
    const [filterPlatform, setFilterPlatform] = useState('');
    const [filterType, setFilterType] = useState('');

    // New Transaction State
    const [newTx, setNewTx] = useState({
        date: new Date().toISOString().slice(0, 16),
        type: 'Buy',
        platform: '',
        pair: '',
        amount: '',
        price: '',
        fee: '',
        notes: ''
    });

    const handleAddTx = () => {
        if (newTx.pair && newTx.amount && newTx.price && newTx.platform) {
            addTransaction({
                id: uuidv4(),
                date: new Date(newTx.date).toISOString(),
                type: newTx.type,
                platform: newTx.platform,
                pair: newTx.pair.toUpperCase(),
                amount: parseFloat(newTx.amount),
                price: parseFloat(newTx.price),
                fee: parseFloat(newTx.fee) || 0,
                notes: newTx.notes
            });
            setNewTx({
                ...newTx,
                pair: '',
                amount: '',
                price: '',
                fee: '',
                notes: ''
            });
        }
    };

    const filteredTransactions = useMemo(() => {
        return transactions
            .filter(t => {
                if (filterCoin && !t.pair.includes(filterCoin.toUpperCase())) return false;
                if (filterPlatform && t.platform !== filterPlatform) return false;
                if (filterType && t.type !== filterType) return false;
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, filterCoin, filterPlatform, filterType]);

    const stats = useMemo(() => {
        return filteredTransactions.reduce((acc, curr) => {
            if (curr.type === 'Buy') {
                acc.buyVolume += curr.amount * curr.price;
            } else if (curr.type === 'Sell') {
                acc.sellVolume += curr.amount * curr.price;
            }
            acc.totalFees += curr.fee;
            return acc;
        }, { buyVolume: 0, sellVolume: 0, totalFees: 0 });
    }, [filteredTransactions]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Transaction History</h2>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">Total Buy Volume</div>
                        <div className="text-2xl font-bold">{formatCurrency(stats.buyVolume)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">Total Sell Volume</div>
                        <div className="text-2xl font-bold">{formatCurrency(stats.sellVolume)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">Total Fees Paid</div>
                        <div className="text-2xl font-bold text-red-500">{formatCurrency(stats.totalFees)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Add New Transaction */}
            <Card>
                <CardHeader>
                    <CardTitle>Record Transaction</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4 items-end">
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="text-xs font-medium mb-1 block">Date</label>
                            <Input
                                type="datetime-local"
                                className="text-xs px-2"
                                value={newTx.date}
                                onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="text-xs font-medium mb-1 block">Type</label>
                            <Select
                                className="text-xs"
                                value={newTx.type}
                                onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                            >
                                {CONFIG.transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="text-xs font-medium mb-1 block">Platform</label>
                            <Select
                                className="text-xs"
                                value={newTx.platform}
                                onChange={(e) => setNewTx({ ...newTx, platform: e.target.value })}
                            >
                                <option value="">Select</option>
                                {CONFIG.platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="text-xs font-medium mb-1 block">Pair (e.g. BTC/USDT)</label>
                            <Input
                                className="text-xs"
                                placeholder="BTC/USDT"
                                value={newTx.pair}
                                onChange={(e) => setNewTx({ ...newTx, pair: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="text-xs font-medium mb-1 block">Amount</label>
                            <Input
                                type="number"
                                className="text-xs"
                                placeholder="0.00"
                                value={newTx.amount}
                                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="text-xs font-medium mb-1 block">Price (USD)</label>
                            <Input
                                type="number"
                                className="text-xs"
                                placeholder="0.00"
                                value={newTx.price}
                                onChange={(e) => setNewTx({ ...newTx, price: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="text-xs font-medium mb-1 block">Fee (USD)</label>
                            <Input
                                type="number"
                                className="text-xs"
                                placeholder="0.00"
                                value={newTx.fee}
                                onChange={(e) => setNewTx({ ...newTx, fee: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <Button className="w-full text-xs" onClick={handleAddTx} disabled={!newTx.pair || !newTx.amount}>
                                <Plus className="mr-1 h-3 w-3" /> Add
                            </Button>
                        </div>
                    </div>
                    <div className="mt-2">
                        <Input
                            className="text-xs"
                            placeholder="Optional notes (strategy, intent, etc.)..."
                            value={newTx.notes}
                            onChange={(e) => setNewTx({ ...newTx, notes: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Transaction List */}
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <CardTitle>Transactions</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Filters:</span>
                        </div>
                        <Input
                            placeholder="Filter Coin (e.g. BTC)"
                            className="w-32 h-8 text-xs"
                            value={filterCoin}
                            onChange={(e) => setFilterCoin(e.target.value)}
                        />
                        <Select
                            className="w-32 h-8 text-xs"
                            value={filterPlatform}
                            onChange={(e) => setFilterPlatform(e.target.value)}
                        >
                            <option value="">All Platforms</option>
                            {CONFIG.platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                        <Select
                            className="w-32 h-8 text-xs"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="">All Types</option>
                            {CONFIG.transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                        {(filterCoin || filterPlatform || filterType) && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                                setFilterCoin('');
                                setFilterPlatform('');
                                setFilterType('');
                            }}>Clear</Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-3 font-medium whitespace-nowrap">Date</th>
                                    <th className="p-3 font-medium">Type</th>
                                    <th className="p-3 font-medium">Platform</th>
                                    <th className="p-3 font-medium">Pair</th>
                                    <th className="p-3 font-medium text-right">Amount</th>
                                    <th className="p-3 font-medium text-right">Price</th>
                                    <th className="p-3 font-medium text-right">Total</th>
                                    <th className="p-3 font-medium text-right">Fee</th>
                                    <th className="p-3 font-medium">Notes</th>
                                    <th className="p-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map(tx => (
                                    <tr key={tx.id} className="border-t hover:bg-muted/50 transition-colors">
                                        <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                                            {format(new Date(tx.date), 'yyyy-MM-dd HH:mm')}
                                        </td>
                                        <td className="p-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tx.type === 'Buy' ? 'bg-green-100 text-green-800' :
                                                    tx.type === 'Sell' ? 'bg-red-100 text-red-800' :
                                                        'bg-secondary text-secondary-foreground'
                                                }`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-xs">
                                            {CONFIG.platforms.find(p => p.id === tx.platform)?.name || tx.platform}
                                        </td>
                                        <td className="p-3 font-medium">{tx.pair}</td>
                                        <td className="p-3 text-right font-mono text-xs">{tx.amount}</td>
                                        <td className="p-3 text-right font-mono text-xs">{formatCurrency(tx.price)}</td>
                                        <td className="p-3 text-right font-mono font-medium text-xs">
                                            {formatCurrency(tx.amount * tx.price)}
                                        </td>
                                        <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                                            {tx.fee > 0 ? formatCurrency(tx.fee) : '-'}
                                        </td>
                                        <td className="p-3 text-xs text-muted-foreground max-w-[150px] truncate">{tx.notes || '-'}</td>
                                        <td className="p-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                onClick={() => removeTransaction(tx.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                                            No transactions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
