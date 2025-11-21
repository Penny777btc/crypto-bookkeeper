import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { CONFIG } from '../config/config';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '../components/ui';
import { formatCurrency } from '../utils/utils';
import { Trash2, Plus, ArrowDownLeft, ArrowUpRight, Filter } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export const FiatLedger: React.FC = () => {
    const { fiatTransactions, addFiatTransaction, removeFiatTransaction } = useStore();
    const [filterMonth, setFilterMonth] = useState<string>('');

    const [newTx, setNewTx] = useState({
        type: 'Deposit',
        currency: 'USD',
        amount: '',
        platform: '',
        notes: '',
        date: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
    });

    const handleAddTx = () => {
        if (newTx.amount && newTx.platform) {
            addFiatTransaction({
                id: uuidv4(),
                type: newTx.type as 'Deposit' | 'Withdraw',
                currency: newTx.currency,
                amount: parseFloat(newTx.amount),
                platform: newTx.platform,
                notes: newTx.notes,
                date: new Date(newTx.date).toISOString()
            });
            setNewTx({
                ...newTx,
                amount: '',
                notes: '',
                platform: ''
            });
        }
    };

    const filteredTransactions = useMemo(() => {
        let txs = [...fiatTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (filterMonth) {
            txs = txs.filter(t => t.date.startsWith(filterMonth));
        }
        return txs;
    }, [fiatTransactions, filterMonth]);

    const stats = useMemo(() => {
        return filteredTransactions.reduce((acc, curr) => {
            if (curr.type === 'Deposit') {
                acc.totalIn += curr.amount;
            } else {
                acc.totalOut += curr.amount;
            }
            return acc;
        }, { totalIn: 0, totalOut: 0 });
    }, [filteredTransactions]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Fiat & USDT Ledger</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Deposits</p>
                                <h3 className="text-2xl font-bold text-green-600">+{formatCurrency(stats.totalIn)}</h3>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full text-green-600">
                                <ArrowDownLeft className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Withdrawals</p>
                                <h3 className="text-2xl font-bold text-red-600">-{formatCurrency(stats.totalOut)}</h3>
                            </div>
                            <div className="p-3 bg-red-100 rounded-full text-red-600">
                                <ArrowUpRight className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Net Flow</p>
                                <h3 className={`text-2xl font-bold ${stats.totalIn - stats.totalOut >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                                    {formatCurrency(stats.totalIn - stats.totalOut)}
                                </h3>
                            </div>
                            <div className="p-3 bg-secondary rounded-full">
                                <span className="font-bold text-xl">=</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>New Record</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="text-sm font-medium mb-2 block">Type</label>
                            <Select
                                value={newTx.type}
                                onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                            >
                                <option value="Deposit">Deposit (In)</option>
                                <option value="Withdraw">Withdraw (Out)</option>
                            </Select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm font-medium mb-2 block">Date</label>
                            <Input
                                type="datetime-local"
                                value={newTx.date}
                                onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm font-medium mb-2 block">Currency</label>
                            <Select
                                value={newTx.currency}
                                onChange={(e) => setNewTx({ ...newTx, currency: e.target.value })}
                            >
                                {CONFIG.fiatCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="USDT">USDT</option>
                                <option value="USDC">USDC</option>
                            </Select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm font-medium mb-2 block">Amount</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={newTx.amount}
                                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm font-medium mb-2 block">Platform/Bank</label>
                            <Input
                                placeholder="e.g. Chase, OTC"
                                value={newTx.platform}
                                onChange={(e) => setNewTx({ ...newTx, platform: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <Button className="w-full" onClick={handleAddTx} disabled={!newTx.amount || !newTx.platform}>
                                <Plus className="mr-2 h-4 w-4" /> Add
                            </Button>
                        </div>
                    </div>
                    <div className="mt-4">
                        <Input
                            placeholder="Optional notes..."
                            value={newTx.notes}
                            onChange={(e) => setNewTx({ ...newTx, notes: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>History</CardTitle>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Input
                            type="month"
                            className="w-40"
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                        />
                        {filterMonth && (
                            <Button variant="ghost" size="sm" onClick={() => setFilterMonth('')}>Clear</Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Type</th>
                                    <th className="p-4 font-medium">Platform</th>
                                    <th className="p-4 font-medium">Currency</th>
                                    <th className="p-4 font-medium text-right">Amount</th>
                                    <th className="p-4 font-medium">Notes</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map(tx => (
                                    <tr key={tx.id} className="border-t hover:bg-muted/50 transition-colors">
                                        <td className="p-4 whitespace-nowrap">{format(new Date(tx.date), 'yyyy-MM-dd HH:mm')}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tx.type === 'Deposit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="p-4">{tx.platform}</td>
                                        <td className="p-4">{tx.currency}</td>
                                        <td className="p-4 text-right font-mono font-medium">
                                            {formatCurrency(tx.amount, tx.currency === 'USDT' || tx.currency === 'USDC' ? 'USD' : tx.currency)}
                                        </td>
                                        <td className="p-4 text-muted-foreground max-w-[200px] truncate">{tx.notes || '-'}</td>
                                        <td className="p-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => removeFiatTransaction(tx.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                            No records found.
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
