import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '../ui';
import { ArrowLeft, Save, Plus, Trash2, Percent, DollarSign, ChevronDown } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CONFIG } from '../../config/config';
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from '../../types';

interface TransactionFormProps {
    initialData?: Transaction | null;
    relatedData?: Transaction | null;
    onSave: (txs: Transaction[]) => void;
    onDelete?: (id: string) => void;
    onCancel: () => void;
}

const VALUE_COINS = [
    { id: 'usdt', symbol: 'USDT' },
    { id: 'usdc', symbol: 'USDC' },
    { id: 'eth', symbol: 'ETH' },
    { id: 'sol', symbol: 'SOL' },
    { id: 'bnb', symbol: 'BNB' },
    { id: 'btc', symbol: 'BTC' },
];

export const TransactionForm: React.FC<TransactionFormProps> = ({ initialData, relatedData, onSave, onDelete, onCancel }) => {

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return new Date().toISOString().slice(0, 10);
        try {
            return new Date(dateString).toISOString().slice(0, 10);
        } catch (e) {
            console.error('Invalid date:', dateString);
            return new Date().toISOString().slice(0, 10);
        }
    };

    const defaultTxState = {
        date: new Date().toISOString().slice(0, 10),
        type: 'Buy',
        platform: '',
        pair: '',
        amount: '',
        value: '',
        valueCoin: 'USDT',
        price: '',
        fee: '',
        feeType: 'fixed' as 'fixed' | 'percent',
        feeRate: '',
        feeTier: 'taker' as 'maker' | 'taker',
        notes: '',
        link: ''
    };

    const [formState, setFormState] = useState(defaultTxState);
    const [sellState, setSellState] = useState({ ...defaultTxState, type: 'Sell' });
    const [showSellSide, setShowSellSide] = useState(false);
    const { cexConfigs, cexData } = useStore();

    // Multi-Price State
    const [isMultiPrice, setIsMultiPrice] = useState(false);
    const [buyFills, setBuyFills] = useState([{ price: '', amount: '', date: '' }]);

    const addBuyFill = () => {
        // Default date to the first fill's date or current form date
        const defaultDate = buyFills.length > 0 && buyFills[0].date ? buyFills[0].date : formState.date;
        setBuyFills([...buyFills, { price: '', amount: '', date: defaultDate }]);
    };
    const removeBuyFill = (index: number) => {
        const newFills = [...buyFills];
        newFills.splice(index, 1);
        setBuyFills(newFills);
    };
    const updateBuyFill = (index: number, field: 'price' | 'amount' | 'date', value: string) => {
        const newFills = [...buyFills];
        newFills[index] = { ...newFills[index], [field]: value };
        setBuyFills(newFills);
    };

    // Sell Side Multi-Price State
    const [isSellMultiPrice, setIsSellMultiPrice] = useState(false);
    const [sellFills, setSellFills] = useState([{ price: '', amount: '', date: '' }]);

    const addSellFill = () => {
        const defaultDate = sellFills.length > 0 && sellFills[0].date ? sellFills[0].date : sellState.date;
        setSellFills([...sellFills, { price: '', amount: '', date: defaultDate }]);
    };
    const removeSellFill = (index: number) => {
        const newFills = [...sellFills];
        newFills.splice(index, 1);
        setSellFills(newFills);
    };
    const updateSellFill = (index: number, field: 'price' | 'amount' | 'date', value: string) => {
        const newFills = [...sellFills];
        newFills[index] = { ...newFills[index], [field]: value };
        setSellFills(newFills);
    };

    // Generate suggested trading pairs from CEX holdings
    const suggestedPairs = React.useMemo(() => {
        const tokens = new Set<string>();
        Object.values(cexData).forEach(exchangeData => {
            if (exchangeData && typeof exchangeData === 'object' && 'balances' in exchangeData) {
                const balances = (exchangeData as any).balances;
                if (Array.isArray(balances)) {
                    balances.forEach((balance: any) => {
                        const symbol = balance.symbol || 'UNKNOWN';
                        if (symbol !== 'UNKNOWN' && symbol !== 'USDT' && parseFloat(balance.total || 0) > 0) {
                            tokens.add(symbol);
                        }
                    });
                }
            }
        });
        return Array.from(tokens).sort().map(token => `${token}/USDT`);
    }, [cexData]);

    const [showPairDropdown, setShowPairDropdown] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowPairDropdown(false);
        if (showPairDropdown) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showPairDropdown]);

    // Calculate Average Price and Total Amount from Sell Fills
    useEffect(() => {
        if (isSellMultiPrice) {
            let totalAmount = 0;
            let totalCost = 0;
            sellFills.forEach(fill => {
                const p = parseFloat(fill.price);
                const a = parseFloat(fill.amount);
                if (!isNaN(p) && !isNaN(a)) {
                    totalAmount += a;
                    totalCost += p * a;
                }
            });

            if (totalAmount > 0) {
                const avgPrice = totalCost / totalAmount;
                setSellState(prev => ({
                    ...prev,
                    amount: totalAmount.toFixed(6),
                    price: avgPrice.toFixed(4),
                    value: totalCost.toFixed(2)
                }));
            }
        }
    }, [sellFills, isSellMultiPrice]);

    // Calculate Average Price and Total Amount from Buy Fills
    useEffect(() => {
        if (isMultiPrice) {
            let totalAmount = 0;
            let totalCost = 0;
            buyFills.forEach(fill => {
                const p = parseFloat(fill.price);
                const a = parseFloat(fill.amount);
                if (!isNaN(p) && !isNaN(a)) {
                    totalAmount += a;
                    totalCost += p * a;
                }
            });

            if (totalAmount > 0) {
                const avgPrice = totalCost / totalAmount;
                setFormState(prev => ({
                    ...prev,
                    amount: totalAmount.toFixed(6),
                    price: avgPrice.toFixed(4),
                    value: totalCost.toFixed(2)
                }));
            }
        }
    }, [buyFills, isMultiPrice]);

    useEffect(() => {
        if (initialData) {
            // Normalize platform: try to match by name (case-insensitive) or ID
            const normalizedPlatform = initialData.platform?.toLowerCase() || '';
            const matchedPlatform = CONFIG.platforms.find(
                p => p.id === normalizedPlatform || p.name.toLowerCase() === normalizedPlatform
            );

            const platformId = matchedPlatform ? matchedPlatform.id : (initialData.platform || 'other');

            setFormState({
                date: formatDate(initialData.date),
                type: initialData.type || 'Buy',
                platform: platformId,
                pair: initialData.pair || '',
                amount: (initialData.amount ?? 0).toString(),
                value: ((initialData.amount ?? 0) * (initialData.price ?? 0)).toFixed(2),
                valueCoin: 'USDT', // Default or infer if possible
                price: (initialData.price ?? 0).toString(),
                fee: (initialData.fee ?? 0).toString(),
                feeType: 'fixed',
                feeRate: '',
                feeTier: 'taker',
                notes: initialData.notes || '',
                link: initialData.link || ''
            });

            // Load Buy Fills
            if (initialData.fills && initialData.fills.length > 0) {
                setIsMultiPrice(true);
                setBuyFills(initialData.fills.map(f => ({
                    price: (f.price ?? 0).toString(),
                    amount: (f.amount ?? 0).toString(),
                    date: formatDate(f.date)
                })));
            }

            if (relatedData) {
                setShowSellSide(true);
                setSellState({
                    date: formatDate(relatedData.date),
                    type: 'Sell',
                    platform: relatedData.platform || '',
                    pair: relatedData.pair || '',
                    amount: (relatedData.amount ?? 0).toString(),
                    value: ((relatedData.amount ?? 0) * (relatedData.price ?? 0)).toFixed(2),
                    valueCoin: 'USDT',
                    price: (relatedData.price ?? 0).toString(),
                    fee: (relatedData.fee ?? 0).toString(),
                    feeType: 'fixed',
                    feeRate: '',
                    feeTier: 'taker',
                    notes: relatedData.notes || '',
                    link: relatedData.link || ''
                });

                // Load Sell Fills
                if (relatedData.fills && relatedData.fills.length > 0) {
                    setIsSellMultiPrice(true);
                    setSellFills(relatedData.fills.map(f => ({
                        price: (f.price ?? 0).toString(),
                        amount: (f.amount ?? 0).toString(),
                        date: formatDate(f.date)
                    })));
                }
            } else {
                setShowSellSide(false);
            }
        }
    }, [initialData, relatedData]);

    const handleCalc = (field: 'amount' | 'value' | 'price', val: string, isSell = false) => {
        const target = isSell ? sellState : formState;
        const setTarget = isSell ? setSellState : setFormState;
        const isMulti = isSell ? isSellMultiPrice : isMultiPrice;

        // If Multi-Price is active, disable manual calc for amount/price/value (except value coin maybe?)
        // Actually, user might want to edit value manually? 
        // But our effect overwrites it. So let's just allow updates but effect will override if fills change.
        // If user types in amount/price inputs while multi-price is on, it might be confusing because inputs are read-only or hidden.
        // If inputs are hidden, this function won't be called for them.

        let updates: any = { [field]: val };
        const price = parseFloat(field === 'price' ? val : target.price);
        const amount = parseFloat(field === 'amount' ? val : target.amount);
        const value = parseFloat(field === 'value' ? val : target.value);

        if (!isMulti) {
            if (field === 'amount') {
                // User is editing amount
                // Priority: if value exists, calculate price. Otherwise if price exists, calculate value.
                if (!isNaN(value) && value !== 0) {
                    // Value exists, calculate price from value/amount
                    if (!isNaN(amount) && amount !== 0) {
                        updates.price = (value / amount).toFixed(8);
                    }
                } else if (!isNaN(price) && price !== 0) {
                    // No value, but price exists, calculate value
                    updates.value = (amount * price).toFixed(2);
                }
            } else if (field === 'value') {
                // User is editing value
                // Priority: if amount exists, calculate price. Otherwise if price exists, calculate amount.
                if (!isNaN(amount) && amount !== 0) {
                    // Amount exists, calculate price from value/amount
                    if (!isNaN(value)) {
                        updates.price = (value / amount).toFixed(8);
                    }
                } else if (!isNaN(price) && price !== 0) {
                    // No amount, but price exists, calculate amount
                    updates.amount = (value / price).toFixed(6);
                }
            } else if (field === 'price' && !isNaN(price)) {
                // User is editing price
                // Priority: Prioritize Value. If Value exists, keep it fixed and recalc Amount.
                // Only recalc Value if Value is empty/zero.
                if (!isNaN(value) && value !== 0) {
                    updates.amount = (value / price).toFixed(6);
                } else if (!isNaN(amount)) {
                    updates.value = (amount * price).toFixed(2);
                }
            }
        }

        setTarget(prev => {
            const newState = { ...prev, ...updates };

            // Sync Buy Amount to Sell Amount if enabled and not editing an existing sell transaction (or maybe always sync if user wants?)
            // User request: "input total value and price, frontend auto calc amount... sell module should also appear amount value"
            // Let's sync if it's the Buy side being edited and Sell side is active
            if (!isSell && showSellSide && !relatedData && !isMultiPrice && !isSellMultiPrice) {
                // Only sync if we are creating a NEW pair, otherwise we might overwrite existing sell data
                if (updates.amount) {
                    setSellState(prevSell => ({ ...prevSell, amount: updates.amount }));
                }
            }
            return newState;
        });

        // If we just calculated amount on Buy side, we need to sync it to Sell side
        if (!isSell && showSellSide && !relatedData && !isMultiPrice && !isSellMultiPrice) {
            if (field === 'value' && !isNaN(price) && !isNaN(value) && price !== 0) {
                const newAmount = (value / price).toFixed(6);
                setSellState(prev => ({ ...prev, amount: newAmount }));
            }
        }
    };

    // Auto-fill Fee Rate from CEX Config
    useEffect(() => {
        if (formState.platform && formState.platform !== 'other') {
            const config = cexConfigs.find(c => c.platformId === formState.platform);
            if (config) {
                const selectedRate = formState.feeTier === 'maker' ? config.makerFeeRate : config.takerFeeRate;
                if (selectedRate !== undefined) {
                    setFormState(prev => {
                        // Only auto-fill if fee rate is empty or different
                        if (!prev.feeRate || parseFloat(prev.feeRate) !== selectedRate) {
                            const rate = selectedRate.toString();
                            const value = parseFloat(prev.value);
                            const fee = !isNaN(value) ? (value * (selectedRate / 100)).toFixed(4) : '';
                            return {
                                ...prev,
                                feeType: 'percent',
                                feeRate: rate,
                                fee: fee
                            };
                        }
                        return prev;
                    });
                }
            }
        }
    }, [formState.platform, formState.feeTier, cexConfigs]);

    // Auto-fill Sell Fee Rate from CEX Config
    useEffect(() => {
        if (formState.platform && formState.platform !== 'other' && showSellSide) {
            const config = cexConfigs.find(c => c.platformId === formState.platform);
            if (config) {
                const selectedRate = sellState.feeTier === 'maker' ? config.makerFeeRate : config.takerFeeRate;
                if (selectedRate !== undefined) {
                    setSellState(prev => {
                        if (!prev.feeRate || parseFloat(prev.feeRate) !== selectedRate) {
                            const rate = selectedRate.toString();
                            const value = parseFloat(prev.value);
                            const fee = !isNaN(value) ? (value * (selectedRate / 100)).toFixed(4) : '';
                            return {
                                ...prev,
                                feeType: 'percent',
                                feeRate: rate,
                                fee: fee
                            };
                        }
                        return prev;
                    });
                }
            }
        }
    }, [formState.platform, sellState.feeTier, cexConfigs, showSellSide]);

    // Recalculate Fee when Value or Fee Rate changes (if in percent mode)
    useEffect(() => {
        if (formState.feeType === 'percent' && formState.feeRate) {
            const value = parseFloat(formState.value);
            const rate = parseFloat(formState.feeRate);
            if (!isNaN(value) && !isNaN(rate)) {
                const newFee = (value * (rate / 100)).toFixed(4);
                if (newFee !== formState.fee) {
                    setFormState(prev => ({ ...prev, fee: newFee }));
                }
            }
        }
    }, [formState.value, formState.feeRate, formState.feeType]);

    // Same for Sell Side
    useEffect(() => {
        if (sellState.feeType === 'percent' && sellState.feeRate) {
            const value = parseFloat(sellState.value);
            const rate = parseFloat(sellState.feeRate);
            if (!isNaN(value) && !isNaN(rate)) {
                const newFee = (value * (rate / 100)).toFixed(4);
                if (newFee !== sellState.fee) {
                    setSellState(prev => ({ ...prev, fee: newFee }));
                }
            }
        }
    }, [sellState.value, sellState.feeRate, sellState.feeType]);

    const handleSave = () => {
        const platform = formState.platform;
        console.log('Handle Save Triggered');
        console.log('Form State:', formState);
        console.log('Platform:', platform);

        if (!formState.pair || !platform) {
            console.error('Validation Failed: Missing pair or platform');
            alert('Please fill in all required fields (Pair and Platform).');
            return;
        }

        const txs: Transaction[] = [];
        let buyTx: Transaction | undefined;

        // Check if Buy side is valid (has amount and price)
        const isBuyValid = formState.amount && parseFloat(formState.amount) > 0 && formState.price && parseFloat(formState.price) > 0;

        if (isBuyValid) {
            buyTx = {
                id: initialData?.id || uuidv4(),
                date: new Date(formState.date).toISOString(),
                type: formState.type,
                platform: platform,
                pair: formState.pair.toUpperCase(),
                amount: parseFloat(formState.amount),
                price: parseFloat(formState.price),
                fee: parseFloat(formState.fee) || 0,
                notes: formState.notes,
                link: formState.link,
                // Add Fills if Multi-Price is active
                fills: isMultiPrice ? buyFills.map(f => ({
                    price: parseFloat(f.price),
                    amount: parseFloat(f.amount),
                    date: f.date
                })) : undefined
            };
            txs.push(buyTx);
        }

        // Check if Sell side is valid
        const isSellValid = showSellSide && sellState.amount && parseFloat(sellState.amount) > 0 && sellState.price && parseFloat(sellState.price) > 0;

        if (isSellValid) {
            const sellId = relatedData?.id || uuidv4();
            const sellAmount = parseFloat(sellState.amount);
            const sellPrice = parseFloat(sellState.price);

            let pnl: number | undefined;
            let apr: number | undefined;
            let relatedId: string | undefined;

            // Only calculate PnL/APR if Buy side exists and is valid
            if (buyTx) {
                const buyPrice = buyTx.price;
                pnl = (sellAmount * sellPrice) - (sellAmount * buyPrice);
                const daysDiff = (new Date(sellState.date).getTime() - new Date(formState.date).getTime()) / (1000 * 3600 * 24);
                const cost = sellAmount * buyPrice;
                apr = daysDiff > 0 && cost > 0 ? (pnl / cost) * (365 / daysDiff) * 100 : 0;
                relatedId = buyTx.id;

                // Link buy to sell
                buyTx.relatedTransactionId = sellId;
            }

            const sellTx: Transaction = {
                id: sellId,
                date: new Date(sellState.date).toISOString(),
                type: 'Sell',
                platform: platform,
                pair: formState.pair.toUpperCase(),
                amount: sellAmount,
                price: sellPrice,
                fee: parseFloat(sellState.fee) || 0,
                relatedTransactionId: relatedId,
                pnl,
                apr,
                // If Buy side is invalid, use the main form notes/link for the Sell transaction
                notes: !buyTx ? formState.notes : sellState.notes,
                link: !buyTx ? formState.link : sellState.link,
                // Add Sell Fills
                fills: isSellMultiPrice ? sellFills.map(f => ({
                    price: parseFloat(f.price),
                    amount: parseFloat(f.amount),
                    date: f.date
                })) : undefined
            };
            txs.push(sellTx);
        }

        if (txs.length === 0) {
            alert('Please enter valid amount and price for at least one side (Buy or Sell).');
            return;
        }

        // Check for deletions: if we had initial/related data but didn't create a corresponding transaction, delete it.
        if (initialData && !txs.find(t => t.id === initialData.id) && onDelete) {
            console.log('Deleting orphaned Buy transaction:', initialData.id);
            onDelete(initialData.id);
        }
        if (relatedData && !txs.find(t => t.id === relatedData.id) && onDelete) {
            console.log('Deleting orphaned Sell transaction:', relatedData.id);
            onDelete(relatedData.id);
        }

        onSave(txs);
    };

    // Auto-fill sell side when enabled (only for new transactions)
    useEffect(() => {
        if (showSellSide && !relatedData && !initialData) {
            setSellState(prev => ({
                ...prev,
                pair: formState.pair,
                amount: formState.amount,
                value: formState.value,
                price: formState.price,
                date: formState.date,
            }));
        }
    }, [showSellSide, formState.pair, formState.amount, formState.value, formState.price, formState.date, relatedData, initialData]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onCancel}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {initialData ? 'Edit Transaction' : 'Record Transaction'}
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Form */}
                <Card className="bg-card border-border shadow-lg">
                    <CardHeader className="border-b border-border pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Transaction Details</CardTitle>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${formState.type === 'Buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                {formState.type.toUpperCase()}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Date & Time</label>
                                <Input
                                    type="date"
                                    className="bg-muted/50 border-input"
                                    value={formState.date}
                                    onChange={(e) => setFormState({ ...formState, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Platform</label>
                                <Select
                                    className="bg-muted/50 border-input"
                                    value={formState.platform}
                                    onChange={(e) => setFormState({ ...formState, platform: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    {CONFIG.platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    <option value="other">Other</option>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Pair</label>
                            <div className="relative">
                                <Input
                                    className="bg-muted/50 border-input font-mono pr-10"
                                    placeholder="BTC/USDT"
                                    value={formState.pair}
                                    onChange={(e) => setFormState({ ...formState, pair: e.target.value })}
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-2 p-1 hover:bg-muted rounded"
                                    onClick={() => setShowPairDropdown(!showPairDropdown)}
                                >
                                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPairDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showPairDropdown && suggestedPairs.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-background border border-border rounded-lg shadow-lg">
                                        {suggestedPairs.map(pair => (
                                            <button
                                                key={pair}
                                                type="button"
                                                className="w-full px-3 py-2 text-left hover:bg-muted text-sm font-mono"
                                                onClick={() => {
                                                    setFormState({ ...formState, pair });
                                                    setShowPairDropdown(false);
                                                }}
                                            >
                                                {pair}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Value (Total)</label>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-muted-foreground cursor-pointer select-none" htmlFor="multiPrice">Multi-Price</label>
                                    <input
                                        type="checkbox"
                                        id="multiPrice"
                                        className="toggle toggle-xs"
                                        checked={isMultiPrice}
                                        onChange={(e) => setIsMultiPrice(e.target.checked)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Select
                                        className="w-24 bg-muted/50 border-input"
                                        value={formState.valueCoin}
                                        onChange={(e) => setFormState({ ...formState, valueCoin: e.target.value })}
                                    >
                                        {VALUE_COINS.map(c => <option key={c.id} value={c.symbol}>{c.symbol}</option>)}
                                    </Select>
                                    <Input
                                        type="number"
                                        className="bg-muted/50 border-input flex-1 font-mono"
                                        placeholder="0.00"
                                        value={formState.value}
                                        onChange={(e) => handleCalc('value', e.target.value)}
                                        readOnly={isMultiPrice}
                                    />
                                </div>
                            </div>

                            {isMultiPrice ? (
                                <div className="space-y-3">
                                    <div className="text-xs font-medium text-muted-foreground flex justify-between px-1">
                                        <span>Fills (Date / Price / Amount)</span>
                                        <span>Avg Price: {formState.price ? parseFloat(formState.price).toFixed(4) : '-'}</span>
                                    </div>
                                    {buyFills.map((fill, index) => (
                                        <div key={index} className="flex gap-1.5 items-center">
                                            <Input
                                                type="date"
                                                className="bg-muted/50 border-input text-xs w-32"
                                                value={fill.date}
                                                onChange={(e) => updateBuyFill(index, 'date', e.target.value)}
                                            />
                                            <Input
                                                type="number"
                                                className="bg-muted/50 border-input font-mono text-xs flex-1"
                                                placeholder="Price"
                                                value={fill.price}
                                                onChange={(e) => updateBuyFill(index, 'price', e.target.value)}
                                            />
                                            <Input
                                                type="number"
                                                className="bg-muted/50 border-input font-mono text-xs flex-1"
                                                placeholder="Amount"
                                                value={fill.amount}
                                                onChange={(e) => updateBuyFill(index, 'amount', e.target.value)}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeBuyFill(index)}
                                                disabled={buyFills.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs border-dashed"
                                        onClick={addBuyFill}
                                    >
                                        <Plus className="mr-2 h-3 w-3" /> Add Fill
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Price</label>
                                        <Input
                                            type="number"
                                            className="bg-muted/50 border-input font-mono"
                                            placeholder="0.00"
                                            value={formState.price}
                                            onChange={(e) => handleCalc('price', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Amount</label>
                                        <Input
                                            type="number"
                                            className="bg-muted/50 border-input font-mono"
                                            placeholder="0.00"
                                            value={formState.amount}
                                            onChange={(e) => handleCalc('amount', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground flex justify-between">
                                <span>Fee</span>
                                <div className="flex items-center gap-1 bg-muted rounded p-0.5">
                                    <button
                                        className={`p-0.5 rounded ${formState.feeType === 'fixed' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                                        onClick={() => setFormState({ ...formState, feeType: 'fixed' })}
                                    >
                                        <DollarSign className="h-3 w-3" />
                                    </button>
                                    <button
                                        className={`p-0.5 rounded ${formState.feeType === 'percent' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                                        onClick={() => {
                                            setFormState({ ...formState, feeType: 'percent' });
                                        }}
                                    >
                                        <Percent className="h-3 w-3" />
                                    </button>
                                </div>
                            </label>
                            {formState.feeType === 'percent' ? (
                                <div className="flex gap-2">
                                    <div className="flex gap-1 bg-muted rounded p-0.5">
                                        <button
                                            className={`px-2 py-1 text-xs rounded ${formState.feeTier === 'maker' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                                            onClick={() => setFormState({ ...formState, feeTier: 'maker' })}
                                        >
                                            Maker
                                        </button>
                                        <button
                                            className={`px-2 py-1 text-xs rounded ${formState.feeTier === 'taker' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                                            onClick={() => setFormState({ ...formState, feeTier: 'taker' })}
                                        >
                                            Taker
                                        </button>
                                    </div>
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            className="bg-muted/50 border-input pr-6"
                                            placeholder="0.00"
                                            value={formState.feeRate}
                                            onChange={(e) => setFormState({ ...formState, feeRate: e.target.value })}
                                        />
                                        <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">%</span>
                                    </div>
                                </div>
                            ) : (
                                <Input
                                    type="number"
                                    className="bg-muted/50 border-input"
                                    placeholder="0.00"
                                    value={formState.fee}
                                    onChange={(e) => setFormState({ ...formState, fee: e.target.value })}
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Link</label>
                            <Input
                                className="bg-muted/50 border-input"
                                placeholder="https://..."
                                value={formState.link}
                                onChange={(e) => setFormState({ ...formState, link: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Notes</label>
                            <Input
                                className="bg-muted/50 border-input"
                                placeholder="Optional notes..."
                                value={formState.notes}
                                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className={`bg-card border-border shadow-lg transition-all duration-200 ${showSellSide ? 'opacity-100' : 'opacity-60'}`}>
                    <CardHeader className="border-b border-border pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="showSellSide"
                                        className="hidden"
                                        checked={showSellSide}
                                        onChange={(e) => setShowSellSide(e.target.checked)}
                                    />
                                    <label
                                        htmlFor="showSellSide"
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${showSellSide ? 'bg-primary' : 'bg-muted'}`}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${showSellSide ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </label>
                                </div>
                                <CardTitle className="text-lg text-muted-foreground">Closing Transaction</CardTitle>
                            </div>
                            {showSellSide && (
                                <div className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-500">
                                    SELL
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className={`pt-6 space-y-5 transition-all duration-200 ${showSellSide ? '' : 'pointer-events-none grayscale opacity-50'}`}>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Date & Time</label>
                                <Input
                                    type="date"
                                    className="bg-muted/50 border-input"
                                    value={sellState.date}
                                    onChange={(e) => setSellState({ ...sellState, date: e.target.value })}
                                    tabIndex={showSellSide ? 0 : -1}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Platform</label>
                                <Input
                                    className="bg-muted/20 border-input text-muted-foreground"
                                    value={CONFIG.platforms.find(p => p.id === formState.platform)?.name || formState.platform}
                                    disabled
                                    readOnly
                                    tabIndex={-1}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Pair</label>
                            <Input
                                className="bg-muted/20 border-input font-mono text-muted-foreground"
                                value={formState.pair}
                                disabled
                                readOnly
                                tabIndex={-1}
                            />
                        </div>

                        <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Value (Total)</label>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-muted-foreground cursor-pointer select-none" htmlFor="sellMultiPrice">Multi-Price</label>
                                    <input
                                        type="checkbox"
                                        id="sellMultiPrice"
                                        className="toggle toggle-xs"
                                        checked={isSellMultiPrice}
                                        onChange={(e) => setIsSellMultiPrice(e.target.checked)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Select
                                        className="w-24 bg-muted/50 border-input"
                                        value={formState.valueCoin}
                                        disabled
                                    >
                                        <option value={formState.valueCoin}>{formState.valueCoin}</option>
                                    </Select>
                                    <Input
                                        type="number"
                                        className="bg-muted/50 border-input flex-1 font-mono"
                                        placeholder="0.00"
                                        value={sellState.value}
                                        onChange={(e) => handleCalc('value', e.target.value, true)}
                                        tabIndex={showSellSide ? 0 : -1}
                                        readOnly={isSellMultiPrice}
                                    />
                                </div>
                            </div>

                            {isSellMultiPrice ? (
                                <div className="space-y-3">
                                    <div className="text-xs font-medium text-muted-foreground flex justify-between px-1">
                                        <span>Fills (Date / Price / Amount)</span>
                                        <span>Avg Price: {sellState.price ? parseFloat(sellState.price).toFixed(4) : '-'}</span>
                                    </div>
                                    {sellFills.map((fill, index) => (
                                        <div key={index} className="flex gap-1.5 items-center">
                                            <Input
                                                type="date"
                                                className="bg-muted/50 border-input text-xs w-32"
                                                value={fill.date}
                                                onChange={(e) => updateSellFill(index, 'date', e.target.value)}
                                            />
                                            <Input
                                                type="number"
                                                className="bg-muted/50 border-input font-mono text-xs flex-1"
                                                placeholder="Price"
                                                value={fill.price}
                                                onChange={(e) => updateSellFill(index, 'price', e.target.value)}
                                            />
                                            <Input
                                                type="number"
                                                className="bg-muted/50 border-input font-mono text-xs flex-1"
                                                placeholder="Amount"
                                                value={fill.amount}
                                                onChange={(e) => updateSellFill(index, 'amount', e.target.value)}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeSellFill(index)}
                                                disabled={sellFills.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs border-dashed"
                                        onClick={addSellFill}
                                    >
                                        <Plus className="mr-2 h-3 w-3" /> Add Fill
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Price</label>
                                        <Input
                                            type="number"
                                            className="bg-muted/50 border-input font-mono"
                                            placeholder="0.00"
                                            value={sellState.price}
                                            onChange={(e) => handleCalc('price', e.target.value, true)}
                                            tabIndex={showSellSide ? 0 : -1}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Amount</label>
                                        <Input
                                            type="number"
                                            className="bg-muted/50 border-input font-mono"
                                            placeholder="0.00"
                                            value={sellState.amount}
                                            onChange={(e) => handleCalc('amount', e.target.value, true)}
                                            tabIndex={showSellSide ? 0 : -1}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground flex justify-between">
                                <span>Fee</span>
                                <div className="flex items-center gap-1 bg-muted rounded p-0.5">
                                    <button
                                        className={`p-0.5 rounded ${sellState.feeType === 'fixed' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                                        onClick={() => setSellState({ ...sellState, feeType: 'fixed' })}
                                        tabIndex={showSellSide ? 0 : -1}
                                    >
                                        <DollarSign className="h-3 w-3" />
                                    </button>
                                    <button
                                        className={`p-0.5 rounded ${sellState.feeType === 'percent' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                                        onClick={() => setSellState({ ...sellState, feeType: 'percent' })}
                                        tabIndex={showSellSide ? 0 : -1}
                                    >
                                        <Percent className="h-3 w-3" />
                                    </button>
                                </div>
                            </label>
                            {sellState.feeType === 'percent' ? (
                                <div className="flex gap-2">
                                    <div className="flex gap-1 bg-muted rounded p-0.5">
                                        <button
                                            className={`px-2 py-1 text-xs rounded ${sellState.feeTier === 'maker' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                                            onClick={() => setSellState({ ...sellState, feeTier: 'maker' })}
                                            tabIndex={showSellSide ? 0 : -1}
                                        >
                                            Maker
                                        </button>
                                        <button
                                            className={`px-2 py-1 text-xs rounded ${sellState.feeTier === 'taker' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                                            onClick={() => setSellState({ ...sellState, feeTier: 'taker' })}
                                            tabIndex={showSellSide ? 0 : -1}
                                        >
                                            Taker
                                        </button>
                                    </div>
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            className="bg-muted/50 border-input pr-6"
                                            placeholder="0.00"
                                            value={sellState.feeRate}
                                            onChange={(e) => setSellState({ ...sellState, feeRate: e.target.value })}
                                            tabIndex={showSellSide ? 0 : -1}
                                        />
                                        <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">%</span>
                                    </div>
                                </div>
                            ) : (
                                <Input
                                    type="number"
                                    className="bg-muted/50 border-input"
                                    placeholder="0.00"
                                    value={sellState.fee}
                                    onChange={(e) => setSellState({ ...sellState, fee: e.target.value })}
                                    tabIndex={showSellSide ? 0 : -1}
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Link</label>
                            <Input
                                className="bg-muted/50 border-input"
                                placeholder="https://..."
                                value={sellState.link}
                                onChange={(e) => setSellState({ ...sellState, link: e.target.value })}
                                tabIndex={showSellSide ? 0 : -1}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Notes</label>
                            <Input
                                className="bg-muted/50 border-input"
                                placeholder="Optional notes..."
                                value={sellState.notes}
                                onChange={(e) => setSellState({ ...sellState, notes: e.target.value })}
                                tabIndex={showSellSide ? 0 : -1}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end pt-6">
                <Button size="lg" onClick={handleSave} className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                    <Save className="mr-2 h-4 w-4" />
                    {initialData ? 'Update Transaction' : 'Save Transaction(s)'}
                </Button>
            </div>
        </div >
    );
};
