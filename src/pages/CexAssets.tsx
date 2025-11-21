import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { CONFIG } from '../config/config';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '../components/ui';
import { formatCurrency } from '../utils/utils';
import { RefreshCw, Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, Database } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const CexAssets: React.FC = () => {
    const { cexConfigs, addCexConfig, removeCexConfig, cexData, setCexData } = useStore();
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [newConfig, setNewConfig] = useState({ platformId: '', apiKey: '', apiSecret: '', name: '' });
    const [loading, setLoading] = useState(false);

    // UI States
    const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [sortDesc, setSortDesc] = useState(true); // Default sort by value desc
    const [showCny, setShowCny] = useState(false);

    // Use persisted data if available, otherwise null
    const displayData = cexData;
    const CNY_RATE = 7.25; // Fixed rate for now

    // Auto-expand cards on mount if data exists
    useEffect(() => {
        if (displayData && displayData.exchanges) {
            const initialExpanded: Record<string, boolean> = {};
            Object.keys(displayData.exchanges).forEach(id => {
                initialExpanded[id] = true;
            });
            setExpandedCards(initialExpanded);
        }
    }, [displayData]);



    // Helper to get CoinGecko URL
    const getCoingeckoUrl = (symbol: string) => {
        const map: Record<string, string> = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'USDC': 'usd-coin',
            'USDT': 'tether',
            'MNT': 'mantle',
            'TON': 'the-open-network',
            'BNB': 'binancecoin',
            'DOT': 'polkadot',
            'ADA': 'cardano',
            'SUI': 'sui',
            'BBSOL': 'bybit-staked-sol',
            'XRP': 'ripple',
            'DOGE': 'dogecoin',
            'AVAX': 'avalanche-2',
            'LINK': 'chainlink',
            'MATIC': 'matic-network',
            'DAI': 'dai',
            'WBTC': 'wrapped-bitcoin',
            'UNI': 'uniswap',
            'LTC': 'litecoin'
        };

        const id = map[symbol.toUpperCase()];
        if (id) {
            return `https://www.coingecko.com/en/coins/${id}`;
        }
        return `https://www.coingecko.com/en/search?query=${symbol}`;
    };

    const toggleCard = (id: string) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddConfig = () => {
        if (newConfig.platformId && newConfig.apiKey && newConfig.apiSecret) {
            addCexConfig({
                id: uuidv4(),
                ...newConfig
            });
            setNewConfig({ platformId: '', apiKey: '', apiSecret: '', name: '' });
        }
    };

    const fetchRealData = async () => {
        setLoading(true);
        const data: any = {
            totalUsd: 0,
            exchanges: {}
        };

        try {
            for (const config of cexConfigs) {
                try {
                    const response = await fetch('http://localhost:3001/api/cex/balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            platformId: config.platformId,
                            apiKey: config.apiKey,
                            apiSecret: config.apiSecret
                        })
                    });

                    if (!response.ok) throw new Error('Failed to fetch');

                    const result = await response.json();

                    // Result now contains balances with { symbol, amount, type, price, value }
                    // Calculate total for this exchange
                    const exchangeTotal = result.balances.reduce((acc: number, curr: any) => acc + curr.value, 0);

                    data.totalUsd += exchangeTotal;
                    data.exchanges[config.id] = {
                        name: config.name || result.platform,
                        total: exchangeTotal,
                        balances: result.balances
                    };

                    // Auto-expand cards that have data
                    setExpandedCards(prev => ({ ...prev, [config.id]: true }));

                } catch (err) {
                    console.error(`Failed to fetch for ${config.name}:`, err);
                    // Keep existing data or show error state?
                }
            }
            setCexData(data); // Save to store (persisted)
        } catch (error) {
            console.error("Global fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatValue = (usdValue: number) => {
        if (showCny) {
            return `¥${formatCurrency(usdValue * CNY_RATE).replace('$', '')}`;
        }
        return formatCurrency(usdValue);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">CEX Assets</h2>
                <div className="flex gap-2">
                    <div className="bg-muted p-1 rounded-lg flex text-sm">
                        <button
                            className={`px-3 py-1 rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            Dashboard
                        </button>
                        <button
                            className={`px-3 py-1 rounded-md transition-all ${activeTab === 'settings' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            API Settings
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'settings' && (
                <Card>
                    <CardHeader>
                        <CardTitle>API Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 items-end">
                            <div className="md:col-span-1">
                                <label className="text-sm font-medium mb-2 block">Platform</label>
                                <Select
                                    value={newConfig.platformId}
                                    onChange={(e) => setNewConfig({ ...newConfig, platformId: e.target.value })}
                                >
                                    <option value="">Select Platform</option>
                                    {CONFIG.platforms.filter(p => p.type === 'CEX').map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-sm font-medium mb-2 block">Name (Optional)</label>
                                <Input
                                    placeholder="My Account"
                                    value={newConfig.name}
                                    onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-sm font-medium mb-2 block">API Key</label>
                                <Input
                                    placeholder="Key"
                                    value={newConfig.apiKey}
                                    onChange={(e) => setNewConfig({ ...newConfig, apiKey: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-sm font-medium mb-2 block">API Secret</label>
                                <Input
                                    type="password"
                                    placeholder="Secret"
                                    value={newConfig.apiSecret}
                                    onChange={(e) => setNewConfig({ ...newConfig, apiSecret: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <Button className="w-full" onClick={handleAddConfig} disabled={!newConfig.platformId || !newConfig.apiKey || !newConfig.apiSecret}>
                                    <Plus className="mr-2 h-4 w-4" /> Add
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {cexConfigs.map(config => (
                                <div key={config.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="flex items-center gap-4">
                                        <div className="font-medium w-32">
                                            {CONFIG.platforms.find(p => p.id === config.platformId)?.name}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {config.name && <span className="mr-2">({config.name})</span>}
                                            <span className="font-mono">{config.apiKey.substring(0, 6)}...</span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" onClick={() => removeCexConfig(config.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                            {cexConfigs.length === 0 && (
                                <div className="text-center text-muted-foreground py-4">
                                    No CEX APIs configured.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Button onClick={fetchRealData} variant="outline" disabled={loading}>
                                <Database className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                {displayData ? 'Refresh Data (Real)' : 'Load Data (Real)'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowCny(!showCny)}
                                className="text-muted-foreground"
                            >
                                {showCny ? 'Switch to USD' : 'Switch to CNY'}
                            </Button>
                        </div>
                    </div>

                    {displayData && (
                        <>
                            <Card className="bg-primary text-primary-foreground">
                                <CardContent className="pt-6">
                                    <div className="text-sm opacity-80">Total CEX Balance</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-4xl font-bold">{formatValue(displayData.totalUsd)}</div>
                                        {showCny && <div className="text-lg opacity-80">≈ {formatCurrency(displayData.totalUsd)}</div>}
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 gap-6">
                                {Object.entries(displayData.exchanges).map(([id, data]: [string, any]) => (
                                    <Card key={id} className="overflow-hidden">
                                        <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleCard(id)}>
                                            <CardTitle className="flex justify-between items-center text-lg">
                                                <div className="flex items-center gap-2">
                                                    {expandedCards[id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    {data.name}
                                                </div>
                                                <span>{formatValue(data.total)}</span>
                                            </CardTitle>
                                        </CardHeader>
                                        {expandedCards[id] && (
                                            <CardContent>
                                                <div className="space-y-2">
                                                    <div className="flex justify-end mb-2">
                                                        <Button
                                                            variant="ghost"
                                                            className="h-6 text-xs"
                                                            onClick={(e) => { e.stopPropagation(); setSortDesc(!sortDesc); }}
                                                        >
                                                            Sort by Value {sortDesc ? '↓' : '↑'}
                                                        </Button>
                                                    </div>
                                                    <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground mb-2 px-2">
                                                        <div className="col-span-3">Asset</div>
                                                        <div className="col-span-3">Type</div>
                                                        <div className="col-span-3 text-right">Price</div>
                                                        <div className="col-span-3 text-right">Value</div>
                                                    </div>
                                                    {data.balances
                                                        .sort((a: any, b: any) => sortDesc ? b.value - a.value : a.value - b.value)
                                                        .map((balance: any, idx: number) => (
                                                            <div key={idx} className="grid grid-cols-12 text-sm border-b last:border-0 py-2 px-2 items-center hover:bg-muted/50">
                                                                <div className="col-span-3">
                                                                    <div className="font-medium flex items-center gap-1">
                                                                        <a
                                                                            href={getCoingeckoUrl(balance.symbol)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="hover:text-blue-500 hover:underline cursor-pointer flex items-center gap-1"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            {balance.symbol}
                                                                            <ExternalLink className="w-3 h-3 opacity-50" />
                                                                        </a>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">{balance.amount.toFixed(4)}</div>
                                                                </div>
                                                                <div className="col-span-3 text-xs">
                                                                    <span className="bg-secondary px-2 py-1 rounded-full">
                                                                        {balance.type || 'Spot'}
                                                                    </span>
                                                                </div>
                                                                <div className="col-span-3 text-right text-muted-foreground">
                                                                    {showCny ? '¥' : '$'}
                                                                    {(balance.price * (showCny ? CNY_RATE : 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                                </div>
                                                                <div className="col-span-3 text-right font-medium">
                                                                    {showCny ? '¥' : '$'}
                                                                    {(balance.value * (showCny ? CNY_RATE : 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}
                </div >
            )}
        </div >
    );
};
