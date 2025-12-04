
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, Button, Input, Select } from '../ui';
import { formatCurrency } from '../../utils/utils';
import { Trash2, Filter, Edit2, Plus, Download, Upload, FileDown, RotateCcw, CheckSquare, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { format } from 'date-fns';
import { CONFIG } from '../../config/config';
import { Transaction } from '../../types';
import { PnLCalendar } from './PnLCalendar';
import { v4 as uuidv4 } from 'uuid';
import { AIAnalysisSheet } from '../ai/AIAnalysisSheet';

interface TransactionListProps {
    transactions: Transaction[];
    onEdit: (tx: Transaction) => void;
    onDelete: (id: string) => void;
    onAdd: () => void;
    onImport?: (txs: Transaction[]) => void;
}

interface TransactionPair {
    id: string; // Use buy ID or sell ID as unique key
    buy?: Transaction;
    sell?: Transaction;
    date: string;
    platform: string;
    pair: string;
    pnl?: number;
    apr?: number;
}

export const TransactionList: React.FC<TransactionListProps> = ({ transactions, onEdit, onDelete, onAdd, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filters
    const [filterCoin, setFilterCoin] = useState('');
    const [filterPlatform, setFilterPlatform] = useState('');
    const [filterPnL, setFilterPnL] = useState('all'); // all, profit, loss
    const [filterMinApr, setFilterMinApr] = useState('');
    const [filterMaxApr, setFilterMaxApr] = useState('');

    // View Toggle
    const [activeView, setActiveView] = useState<'list' | 'calendar' | 'trash'>('list');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [aiSheetOpen, setAiSheetOpen] = useState(false);
    const [selectedAiSymbol, setSelectedAiSymbol] = useState('');

    const {
        removeTransaction,
        restoreTransaction,
        permanentlyDeleteTransaction
    } = useStore();

    // Time Range Filters
    const [timeRangeType, setTimeRangeType] = useState<'all' | 'year' | 'month' | 'week' | 'custom'>('all');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

    // Reset selection when view changes or filters change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeView, timeRangeType, selectedYear, selectedMonth, customStartDate, customEndDate, filterCoin, filterPlatform, filterPnL, filterMinApr, filterMaxApr]);

    const pairs = useMemo(() => {
        const processed = new Set<string>();
        const result: TransactionPair[] = [];

        // Filter based on view
        const viewTransactions = transactions.filter(t =>
            activeView === 'trash' ? t.isDeleted : !t.isDeleted
        );

        // Sort by date desc
        const sortedTxs = [...viewTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (activeView === 'trash') {
            // Flat list for trash
            return sortedTxs.map(tx => ({
                id: tx.id,
                date: tx.date,
                platform: tx.platform,
                pair: tx.pair,
                buy: tx.type === 'Buy' ? tx : undefined,
                sell: tx.type === 'Sell' ? tx : undefined,
                pnl: undefined,
                apr: undefined
            } as TransactionPair));
        }

        sortedTxs.forEach(tx => {
            if (processed.has(tx.id)) return;

            let pair: TransactionPair = {
                id: tx.id,
                date: tx.date,
                platform: tx.platform,
                pair: tx.pair,
            };

            if (tx.type === 'Buy') {
                pair.buy = tx;
                processed.add(tx.id);

                // Find related sell
                if (tx.relatedTransactionId) {
                    const related = transactions.find(t => t.id === tx.relatedTransactionId && !t.isDeleted);
                    if (related && related.type === 'Sell') {
                        pair.sell = related;
                        pair.pnl = related.pnl;
                        pair.apr = related.apr;
                        processed.add(related.id);
                    }
                }
            } else if (tx.type === 'Sell') {
                pair.sell = tx;
                pair.pnl = tx.pnl;
                pair.apr = tx.apr;
                processed.add(tx.id);

                // Find related buy
                if (tx.relatedTransactionId) {
                    const related = transactions.find(t => t.id === tx.relatedTransactionId && !t.isDeleted);
                    if (related && related.type === 'Buy') {
                        pair.buy = related;
                        // Use Buy's date/platform/pair as primary if available (usually same)
                        pair.date = related.date;
                        pair.platform = related.platform;
                        pair.pair = related.pair;
                        processed.add(related.id);
                    }
                }
            } else {
                // Other types
                pair.buy = tx; // Treat as buy-side for display? Or just separate?
                processed.add(tx.id);
            }
            result.push(pair);
        });

        return result;
    }, [transactions, activeView]);

    const filteredPairs = useMemo(() => {
        return pairs.filter(p => {
            if (filterCoin && !p.pair.includes(filterCoin.toUpperCase())) return false;
            if (filterPlatform && p.platform !== filterPlatform) return false;

            // PnL Filter
            if (filterPnL === 'profit' && (!p.pnl || p.pnl <= 0)) return false;
            if (filterPnL === 'loss' && (!p.pnl || p.pnl >= 0)) return false;

            // APR Filter
            if (filterMinApr && (!p.apr || p.apr < parseFloat(filterMinApr))) return false;
            if (filterMaxApr && (!p.apr || p.apr > parseFloat(filterMaxApr))) return false;

            // Time Range Filter
            if (timeRangeType !== 'all') {
                const txDate = new Date(p.date);
                let startDate: Date | null = null;
                let endDate: Date | null = null;

                if (timeRangeType === 'year') {
                    startDate = new Date(selectedYear, 0, 1);
                    endDate = new Date(selectedYear, 11, 31, 23, 59, 59);
                } else if (timeRangeType === 'month') {
                    startDate = new Date(selectedYear, selectedMonth, 1);
                    endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
                } else if (timeRangeType === 'week') {
                    const today = new Date();
                    const dayOfWeek = today.getDay();
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - dayOfWeek);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    endDate.setHours(23, 59, 59);
                } else if (timeRangeType === 'custom') {
                    if (customStartDate) startDate = new Date(customStartDate);
                    if (customEndDate) {
                        endDate = new Date(customEndDate);
                        endDate.setHours(23, 59, 59);
                    }
                }

                if (startDate && txDate < startDate) return false;
                if (endDate && txDate > endDate) return false;
            }

            return true;
        });
    }, [pairs, filterCoin, filterPlatform, filterPnL, filterMinApr, filterMaxApr, timeRangeType, selectedYear, selectedMonth, customStartDate, customEndDate]);

    const stats = useMemo(() => {
        const activeTxs = transactions.filter(t => !t.isDeleted);
        return activeTxs.reduce((acc, curr) => {
            if (curr.type === 'Buy' && !isNaN(curr.amount) && !isNaN(curr.price)) {
                acc.buyVolume += curr.amount * curr.price;
            } else if (curr.type === 'Sell' && !isNaN(curr.amount) && !isNaN(curr.price)) {
                acc.sellVolume += curr.amount * curr.price;
            }
            if (!isNaN(curr.fee)) {
                acc.totalFees += curr.fee;
            }
            if (curr.pnl && !isNaN(curr.pnl)) {
                acc.totalPnL += curr.pnl;
            }
            return acc;
        }, { buyVolume: 0, sellVolume: 0, totalFees: 0, totalPnL: 0 });
    }, [transactions]);

    // CSV Utilities
    const downloadCSV = (csvContent: string, filename: string) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const template = `Date, Type, Platform, Pair, Amount, Price, Fee, Notes, Link, Fills
2025-01 - 15, Buy, Binance, BTC / USDT, 0.5, 45000, 22.5, First purchase, https://...,
2025-01 - 16, Sell, Binance, BTC / USDT, 1.5, 46000, 23, Multiple sells,, "2025-01-16 | 0.5 @ 45800; 2025-01-16 | 0.5 @ 46000; 2025-01-16 | 0.5 @ 46200"`;
        downloadCSV(template, 'transaction-template.csv');
    };

    const handleExport = () => {
        const headers = ['Date', 'Type', 'Platform', 'Pair', 'Amount', 'Price', 'Fee', 'PnL', 'APR', 'Notes', 'Link', 'Fills'];
        const rows = transactions.map(tx => [
            format(new Date(tx.date), 'yyyy-MM-dd HH:mm'),
            tx.type,
            tx.platform,
            tx.pair,
            tx.amount,
            tx.price,
            tx.fee || 0,
            tx.pnl || '',
            tx.apr || '',
            `"${(tx.notes || '').replace(/"/g, '""')}"`,
            tx.link || '',
            tx.fills ? `"${tx.fills.map(f => `${f.date} | ${f.amount} @ ${f.price}`).join('; ')}"` : ''
        ]);
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        downloadCSV(csv, `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target?.result as string;
            try {
                const importedTxs = parseCSV(csvText);
                if (onImport && importedTxs.length > 0) {
                    onImport(importedTxs);
                    alert(`Successfully imported ${importedTxs.length} transactions`);
                }
            } catch (error) {
                alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        reader.readAsText(file);

        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const parseCSV = (csvText: string): Transaction[] => {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV file is empty or invalid');

        const headers = lines[0].split(',').map(h => h.trim());
        const requiredFields = ['Date', 'Type', 'Platform', 'Pair', 'Amount', 'Price'];

        const missingFields = requiredFields.filter(field => !headers.includes(field));
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        const transactions: Transaction[] = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Robust CSV parsing (handles quoted fields and escaped quotes)
            const values: string[] = [];
            let currentValue = '';
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                const nextChar = line[j + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        currentValue += '"';
                        j++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue.trim());

            const getField = (name: string) => {
                const index = headers.indexOf(name);
                return index >= 0 ? values[index] : '';
            };

            const dateStr = getField('Date');
            const type = getField('Type');
            const platform = getField('Platform');
            const pair = getField('Pair');
            const amountStr = getField('Amount');
            const priceStr = getField('Price');
            const feeStr = getField('Fee');
            const notes = getField('Notes');
            const link = getField('Link');
            const fillsStr = getField('Fills');

            // Validation
            if (!dateStr || !type || !platform || !pair || !amountStr || !priceStr) {
                throw new Error(`Row ${i + 1}: Missing required fields`);
            }

            if (type !== 'Buy' && type !== 'Sell') {
                throw new Error(`Row ${i + 1}: Type must be 'Buy' or 'Sell'`);
            }

            const amount = parseFloat(amountStr);
            const price = parseFloat(priceStr);
            const fee = feeStr ? parseFloat(feeStr) : 0;

            if (isNaN(amount) || isNaN(price)) {
                throw new Error(`Row ${i + 1}: Amount and Price must be valid numbers`);
            }

            let fills: { price: number; amount: number; date: string }[] | undefined;
            if (fillsStr) {
                // Try parsing as simplified format: "Date | Amount @ Price; ..."
                // Also supports legacy JSON format for backward compatibility
                if (fillsStr.trim().startsWith('[') && fillsStr.trim().endsWith(']')) {
                    try {
                        const parsed = JSON.parse(fillsStr);
                        if (Array.isArray(parsed)) fills = parsed;
                    } catch (e) {
                        console.warn(`Row ${i + 1}: Invalid Fills JSON`, e);
                    }
                } else {
                    // Parse simplified format
                    try {
                        fills = fillsStr.split(';').map(item => {
                            const [datePart, rest] = item.split('|').map(s => s.trim());
                            const [amountPart, pricePart] = rest.split('@').map(s => s.trim());

                            const fPrice = parseFloat(pricePart);
                            const fAmount = parseFloat(amountPart);

                            if (!datePart || isNaN(fPrice) || isNaN(fAmount)) {
                                throw new Error('Invalid format');
                            }

                            return {
                                date: datePart,
                                amount: fAmount,
                                price: fPrice
                            };
                        });
                    } catch (e) {
                        console.warn(`Row ${i + 1}: Invalid Fills format`, e);
                    }
                }
            }

            // Normalize platform: try to match by name (case-insensitive) or use as-is
            const normalizedPlatform = platform.toLowerCase();
            const matchedPlatform = CONFIG.platforms.find(
                p => p.id === normalizedPlatform || p.name.toLowerCase() === normalizedPlatform
            );
            const platformId = matchedPlatform ? matchedPlatform.id : platform;

            transactions.push({
                id: uuidv4(),
                date: new Date(dateStr).toISOString(),
                type: type as 'Buy' | 'Sell',
                platform: platformId,
                pair: pair.toUpperCase(),
                amount,
                price,
                fee,
                notes,
                link,
                fills
            });
        }

        return transactions;
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(filteredPairs.map(p => p.id));
            setSelectedIds(allIds);
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = () => {
        if (activeView === 'trash') {
            if (window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} transactions? This action cannot be undone.`)) {
                selectedIds.forEach(id => permanentlyDeleteTransaction(id));
                setSelectedIds(new Set());
            }
        } else {
            if (window.confirm(`Are you sure you want to move ${selectedIds.size} transactions to the Recycle Bin?`)) {
                selectedIds.forEach(id => removeTransaction(id));
                setSelectedIds(new Set());
            }
        }
    };

    const handleBulkRestore = () => {
        selectedIds.forEach(id => restoreTransaction(id));
        setSelectedIds(new Set());
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Transaction History</h2>
                    <div className="flex gap-2">
                        <Button
                            variant={activeView === 'list' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveView('list')}
                        >
                            List
                        </Button>
                        <Button
                            variant={activeView === 'calendar' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveView('calendar')}
                        >
                            Calendar
                        </Button>
                        <Button
                            variant={activeView === 'trash' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveView('trash')}
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Recycle Bin
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <>
                            {activeView === 'trash' ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBulkRestore}
                                        className="text-green-500 hover:text-green-600 border-green-500/30 hover:bg-green-500/10"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Restore ({selectedIds.size})
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleBulkDelete}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Forever ({selectedIds.size})
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleBulkDelete}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete ({selectedIds.size})
                                </Button>
                            )}
                            <div className="w-px h-6 bg-border mx-2" />
                        </>
                    )}
                    <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
                        <FileDown className="mr-2 h-4 w-4" /> Template
                    </Button>
                    <Button onClick={handleImportClick} variant="outline" size="sm">
                        <Upload className="mr-2 h-4 w-4" /> Import
                    </Button>
                    <Button onClick={handleExport} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                    <Button onClick={onAdd} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" /> Record Transaction
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>
            </div>

            {activeView !== 'calendar' ? (
                <>
                    {/* Stats Cards - Dark Mode */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <Card className="bg-card border-border">
                            <CardContent className="pt-6">
                                <div className="text-sm font-medium text-muted-foreground">Total Buy Volume</div>
                                <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.buyVolume)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-border">
                            <CardContent className="pt-6">
                                <div className="text-sm font-medium text-muted-foreground">Total Sell Volume</div>
                                <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.sellVolume)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-border">
                            <CardContent className="pt-6">
                                <div className="text-sm font-medium text-muted-foreground">Total Fees</div>
                                <div className="text-2xl font-bold text-red-500">{formatCurrency(stats.totalFees)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-border">
                            <CardContent className="pt-6">
                                <div className="text-sm font-medium text-muted-foreground">Net PnL</div>
                                <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {stats.totalPnL >= 0 ? '+' : ''}{formatCurrency(stats.totalPnL)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card className="bg-card border-border">
                        <CardContent className="pt-6">
                            {/* Time Range Filter */}
                            <div className="mb-4 pb-4 border-b border-border">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-sm font-medium text-foreground">Time Range:</span>
                                    <div className="flex gap-2 flex-wrap">
                                        <Button
                                            variant={timeRangeType === 'all' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => setTimeRangeType('all')}
                                        >
                                            All
                                        </Button>
                                        <Button
                                            variant={timeRangeType === 'year' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => setTimeRangeType('year')}
                                        >
                                            Year
                                        </Button>
                                        <Button
                                            variant={timeRangeType === 'month' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => setTimeRangeType('month')}
                                        >
                                            Month
                                        </Button>
                                        <Button
                                            variant={timeRangeType === 'week' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => setTimeRangeType('week')}
                                        >
                                            This Week
                                        </Button>
                                        <Button
                                            variant={timeRangeType === 'custom' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => setTimeRangeType('custom')}
                                        >
                                            Custom
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-2 ml-auto">
                                        <Button
                                            variant={isSelectionMode ? "default" : "outline"}
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => {
                                                setIsSelectionMode(!isSelectionMode);
                                                if (isSelectionMode) setSelectedIds(new Set());
                                            }}
                                        >
                                            <CheckSquare className="mr-2 h-3 w-3" />
                                            {isSelectionMode ? 'Cancel Selection' : 'Select'}
                                        </Button>
                                    </div>

                                    {timeRangeType === 'year' && (
                                        <Select
                                            className="w-24 h-8 text-xs bg-muted/50 border-input"
                                            value={selectedYear.toString()}
                                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                        >
                                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </Select>
                                    )}

                                    {timeRangeType === 'month' && (
                                        <>
                                            <Select
                                                className="w-24 h-8 text-xs bg-muted/50 border-input"
                                                value={selectedYear.toString()}
                                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                            >
                                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </Select>
                                            <Select
                                                className="w-28 h-8 text-xs bg-muted/50 border-input"
                                                value={selectedMonth.toString()}
                                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                            >
                                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                                                    <option key={idx} value={idx}>{month}</option>
                                                ))}
                                            </Select>
                                        </>
                                    )}

                                    {timeRangeType === 'custom' && (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="date"
                                                className="w-36 h-8 text-xs bg-muted/50 border-input"
                                                value={customStartDate}
                                                onChange={(e) => setCustomStartDate(e.target.value)}
                                                placeholder="Start Date"
                                            />
                                            <span className="text-muted-foreground text-xs">to</span>
                                            <Input
                                                type="date"
                                                className="w-36 h-8 text-xs bg-muted/50 border-input"
                                                value={customEndDate}
                                                onChange={(e) => setCustomEndDate(e.target.value)}
                                                placeholder="End Date"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-foreground">Filters:</span>
                                </div>
                                <Input
                                    placeholder="Coin (e.g. BTC)"
                                    className="w-32 h-8 text-xs bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                                    value={filterCoin}
                                    onChange={(e) => setFilterCoin(e.target.value)}
                                />
                                <Select
                                    className="w-32 h-8 text-xs bg-muted/50 border-input text-foreground"
                                    value={filterPlatform}
                                    onChange={(e) => setFilterPlatform(e.target.value)}
                                >
                                    <option value="">All Platforms</option>
                                    {CONFIG.platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </Select>
                                <Select
                                    className="w-32 h-8 text-xs bg-muted/50 border-input text-foreground"
                                    value={filterPnL}
                                    onChange={(e) => setFilterPnL(e.target.value)}
                                >
                                    <option value="all">All PnL</option>
                                    <option value="profit">Profit Only</option>
                                    <option value="loss">Loss Only</option>
                                </Select>
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Min APR %"
                                        className="w-24 h-8 text-xs bg-muted/50 border-input text-foreground"
                                        value={filterMinApr}
                                        onChange={(e) => setFilterMinApr(e.target.value)}
                                    />
                                    <span className="text-muted-foreground">-</span>
                                    <Input
                                        placeholder="Max APR %"
                                        className="w-24 h-8 text-xs bg-muted/50 border-input text-foreground"
                                        value={filterMaxApr}
                                        onChange={(e) => setFilterMaxApr(e.target.value)}
                                    />
                                </div>
                                {(filterCoin || filterPlatform || filterPnL !== 'all' || filterMinApr || filterMaxApr || timeRangeType !== 'all') && (
                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => {
                                        setFilterCoin('');
                                        setFilterPlatform('');
                                        setFilterPnL('all');
                                        setFilterMinApr('');
                                        setFilterMaxApr('');
                                        setTimeRangeType('all');
                                        setCustomStartDate('');
                                        setCustomEndDate('');
                                    }}>Clear</Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* List */}
                    <Card className="bg-card border-border">
                        <CardContent className="p-0">
                            <div className="rounded-md overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            {isSelectionMode && (
                                                <th className="p-4 font-medium w-10">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-primary focus:ring-primary"
                                                        checked={selectedIds.size === filteredPairs.length && filteredPairs.length > 0}
                                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                                    />
                                                </th>
                                            )}
                                            <th className="p-4 font-medium whitespace-nowrap">Date</th>
                                            <th className="p-4 font-medium">Platform / Pair</th>
                                            <th className="p-4 font-medium text-center bg-green-500/5">Buy Side (Price / Amt / Val)</th>
                                            <th className="p-4 font-medium text-center bg-red-500/5">Sell Side (Price / Amt / Val)</th>
                                            <th className="p-4 font-medium text-right">PnL</th>
                                            <th className="p-4 font-medium text-right">APR</th>
                                            <th className="p-4 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filteredPairs.map(pair => (
                                            <tr key={pair.id} className={selectedIds.has(pair.id) ? 'bg-muted/50' : 'hover:bg-muted/30 transition-colors'}>
                                                {isSelectionMode && (
                                                    <td className="p-4">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-gray-300 text-primary focus:ring-primary"
                                                            checked={selectedIds.has(pair.id)}
                                                            onChange={(e) => handleSelectOne(pair.id, e.target.checked)}
                                                        />
                                                    </td>
                                                )}
                                                <td className="p-4 whitespace-nowrap text-xs text-muted-foreground">
                                                    {format(new Date(pair.date), 'yyyy-MM-dd HH:mm')}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">{pair.pair}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {CONFIG.platforms.find(p => p.id === pair.platform)?.name || pair.platform}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Buy Side */}
                                                <td className="p-4 bg-green-500/5">
                                                    {pair.buy && !isNaN(pair.buy.price) && !isNaN(pair.buy.amount) ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="font-mono text-xs text-foreground">
                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 10 }).format(pair.buy.price)}
                                                            </span>
                                                            <span className="font-mono text-xs text-muted-foreground">{pair.buy.amount}</span>
                                                            <span className="font-mono text-xs font-medium text-green-500">{formatCurrency(pair.buy.amount * pair.buy.price)}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-right text-muted-foreground">-</div>
                                                    )}
                                                </td>

                                                {/* Sell Side */}
                                                <td className="p-4 bg-red-500/5">
                                                    {pair.sell && !isNaN(pair.sell.price) && !isNaN(pair.sell.amount) ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="font-mono text-xs text-foreground">
                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 10 }).format(pair.sell.price)}
                                                            </span>
                                                            <span className="font-mono text-xs text-muted-foreground">{pair.sell.amount}</span>
                                                            <span className="font-mono text-xs font-medium text-red-500">{formatCurrency(pair.sell.amount * pair.sell.price)}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-right text-muted-foreground">-</div>
                                                    )}
                                                </td>

                                                <td className={`p-4 text-right font-mono text-xs ${pair.pnl && pair.pnl > 0 ? 'text-green-500' : pair.pnl && pair.pnl < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                    {pair.pnl ? formatCurrency(pair.pnl) : '-'}
                                                </td>
                                                <td className="p-4 text-right font-mono text-xs text-muted-foreground">
                                                    {pair.apr ? `${pair.apr.toFixed(2)}%` : '-'}
                                                </td>

                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {activeView === 'trash' ? (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-muted"
                                                                    onClick={() => restoreTransaction(pair.id)}
                                                                    title="Restore"
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-muted"
                                                                    onClick={() => {
                                                                        if (window.confirm('Permanently delete this transaction? This cannot be undone.')) {
                                                                            permanentlyDeleteTransaction(pair.id);
                                                                        }
                                                                    }}
                                                                    title="Delete Forever"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                                    onClick={() => {
                                                                        const symbol = pair.pair.split('/')[0];
                                                                        setSelectedAiSymbol(symbol);
                                                                        setAiSheetOpen(true);
                                                                    }}
                                                                    title="Ask AI Analysis"
                                                                >
                                                                    <Sparkles className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-muted"
                                                                    onClick={() => onEdit(pair.buy || pair.sell!)}
                                                                >
                                                                    <Edit2 className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-muted"
                                                                    onClick={() => onDelete(pair.buy?.id || pair.sell!.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredPairs.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                                    No transactions found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <PnLCalendar transactions={transactions.filter(t => !t.isDeleted)} />
            )}
            {/* AI Analysis Sheet */}
            <AIAnalysisSheet
                isOpen={aiSheetOpen}
                onClose={() => setAiSheetOpen(false)}
                symbol={selectedAiSymbol}
            />
        </div>
    );
};
