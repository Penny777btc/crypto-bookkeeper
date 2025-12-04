import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { CONFIG } from '../config/config';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Switch } from '../components/ui';
import { formatCurrency } from '../utils/utils';
import { getCoingeckoUrl } from '../utils/cryptoUtils';
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, Database, Star, Eye, EyeOff, GripVertical, Edit2, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CexAnalysis } from '../components/cex/CexAnalysis';
import { EarnProductsPanel } from '../components/cex/EarnProductsPanel';
import { ManualAssetsPanel } from '../components/cex/ManualAssetsPanel';

export const CexAssets: React.FC = () => {
    const { t } = useTranslation();
    const { cexConfigs, addCexConfig, removeCexConfig, updateCexConfig, cexData, setCexData, monitoredCoins, addMonitoredCoin, removeMonitoredCoin, hideAmounts, toggleHideAmounts, cexExchangeOrder, setCexExchangeOrder, manualAssets } = useStore();
    const [newConfig, setNewConfig] = useState<{ platformId: string; apiKey: string; apiSecret: string; name: string; password?: string; makerFeeRate?: number; takerFeeRate?: number; enabled?: boolean }>({ platformId: '', apiKey: '', apiSecret: '', name: '', password: '', makerFeeRate: undefined, takerFeeRate: undefined, enabled: true });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [addingToWatchlist, setAddingToWatchlist] = useState<Record<string, boolean>>({});

    // UI States
    const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'analysis' | 'earn'>('dashboard');
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [sortDesc, setSortDesc] = useState(true); // Default sort by value desc
    const [showCny, setShowCny] = useState(false);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [manualAssetsTotal, setManualAssetsTotal] = useState(0);
    const [manualAssetsExpanded, setManualAssetsExpanded] = useState(true);

    // Use persisted data if available, otherwise null
    const displayData = cexData;
    const CNY_RATE = 7.25; // Fixed rate for now

    // Auto-expand cards ONLY on initial mount if data exists
    useEffect(() => {
        if (isInitialLoad && displayData && displayData.exchanges) {
            const initialExpanded: Record<string, boolean> = {};
            Object.keys(displayData.exchanges).forEach(id => {
                initialExpanded[id] = true;
            });
            setExpandedCards(initialExpanded);
            setIsInitialLoad(false);
        }
    }, [isInitialLoad, displayData]);

    // Initialize exchange order on first load if not already set
    // Sync exchange order with available data
    useEffect(() => {
        if (displayData && displayData.exchanges) {
            const availableIds = Object.keys(displayData.exchanges);

            // If order is empty, just set it
            if (cexExchangeOrder.length === 0) {
                if (availableIds.length > 0) {
                    setCexExchangeOrder(availableIds);
                }
                return;
            }

            // Check for missing IDs (newly added exchanges)
            const missingIds = availableIds.filter(id => !cexExchangeOrder.includes(id));

            if (missingIds.length > 0) {
                console.log('Found new exchanges, adding to display order:', missingIds);
                setCexExchangeOrder([...cexExchangeOrder, ...missingIds]);
            }
        }
    }, [displayData, cexExchangeOrder, setCexExchangeOrder]);

    // Calculate manual assets total
    useEffect(() => {
        const fetchManualAssetsPrices = async () => {
            if (manualAssets.length === 0) {
                setManualAssetsTotal(0);
                return;
            }

            const symbols = [...new Set(manualAssets.map(a => a.symbol.toUpperCase()))];
            const symbolToCoinGeckoId: Record<string, string> = {
                'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'BNB': 'binancecoin',
                'ADA': 'cardano', 'OKB': 'okb', 'TON': 'the-open-network', 'SUI': 'sui',
                'MNT': 'mantle', 'USDT': 'tether', 'USDC': 'usd-coin', 'BBSOL': 'bybit-staked-sol', 'MXC': 'mxc'
            };

            const coinGeckoIds = symbols
                .map(symbol => symbolToCoinGeckoId[symbol] || symbol.toLowerCase())
                .join(',');

            try {
                const response = await fetch(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds}&vs_currencies=usd`
                );
                const data = await response.json();

                let total = 0;
                manualAssets.forEach(asset => {
                    const cgId = symbolToCoinGeckoId[asset.symbol.toUpperCase()] || asset.symbol.toLowerCase();
                    if (data[cgId] && data[cgId].usd) {
                        total += asset.amount * data[cgId].usd;
                    }
                });

                setManualAssetsTotal(total);
            } catch (error) {
                console.error('Failed to fetch manual assets prices:', error);
            }
        };

        fetchManualAssetsPrices();
    }, [manualAssets]);

    // Drag and Drop handlers
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        const currentOrder = cexExchangeOrder.length > 0
            ? [...cexExchangeOrder]
            : Object.keys(displayData?.exchanges || {});

        const draggedIndex = currentOrder.indexOf(draggedId);
        const targetIndex = currentOrder.indexOf(targetId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const newOrder = [...currentOrder];
            newOrder.splice(draggedIndex, 1);
            newOrder.splice(targetIndex, 0, draggedId);
            setCexExchangeOrder(newOrder);
        }
        setDraggedId(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
    };



    const toggleCard = (id: string) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSaveConfig = () => {
        if (newConfig.platformId && newConfig.apiKey && newConfig.apiSecret) {
            if (editingId) {
                updateCexConfig(editingId, newConfig);
                setEditingId(null);
            } else {
                addCexConfig({
                    id: uuidv4(),
                    ...newConfig,
                    enabled: newConfig.enabled !== undefined ? newConfig.enabled : true
                });
            }
            setNewConfig({ platformId: '', apiKey: '', apiSecret: '', name: '', password: '', makerFeeRate: undefined, takerFeeRate: undefined, enabled: true });
        }
    };

    const handleEditConfig = (config: any) => {
        setEditingId(config.id);
        setNewConfig({
            platformId: config.platformId,
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            name: config.name || '',
            password: config.password || '',
            makerFeeRate: config.makerFeeRate,
            takerFeeRate: config.takerFeeRate,
            enabled: config.enabled !== undefined ? config.enabled : true
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setNewConfig({ platformId: '', apiKey: '', apiSecret: '', name: '', password: '', makerFeeRate: undefined, takerFeeRate: undefined, enabled: true });
    };

    const fetchRealData = async () => {
        setLoading(true);
        const data: any = {
            totalUsd: 0,
            exchanges: {}
        };

        try {
            for (const config of cexConfigs) {
                if (config.enabled === false) continue; // Skip disabled configs
                try {
                    const response = await fetch('http://localhost:3001/api/cex/balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            platformId: config.platformId,
                            apiKey: config.apiKey,
                            apiSecret: config.apiSecret,
                            password: config.password
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

    const isMonitored = (symbol: string) => {
        return monitoredCoins.some(c => c.symbol.toLowerCase() === symbol.toLowerCase());
    };

    const toggleWatchlist = async (symbol: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const lowerSymbol = symbol.toLowerCase();
        const existing = monitoredCoins.find(c => c.symbol.toLowerCase() === lowerSymbol);

        if (existing) {
            removeMonitoredCoin(existing.id);
        } else {
            setAddingToWatchlist(prev => ({ ...prev, [symbol]: true }));
            try {
                // Search CoinGecko to get the correct ID and Image
                const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${symbol}`);
                const data = await response.json();

                // Find exact match or best match
                const coin = data.coins?.find((c: any) => c.symbol.toLowerCase() === lowerSymbol) || data.coins?.[0];

                if (coin) {
                    addMonitoredCoin({
                        id: coin.id,
                        symbol: coin.symbol,
                        name: coin.name,
                        image: coin.thumb
                    });
                } else {
                    console.warn(`Could not find coin for symbol: ${symbol}`);
                }
            } catch (err) {
                console.error("Failed to add to watchlist", err);
            } finally {
                setAddingToWatchlist(prev => ({ ...prev, [symbol]: false }));
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">{t('cex.page_title', 'CEX Assets')}</h2>
                <div className="flex gap-2">
                    <div className="bg-muted p-1 rounded-lg flex text-sm">
                        <button
                            className={`px-3 py-1 rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            {t('nav.dashboard', 'Dashboard')}
                        </button>
                        <button
                            className={`px-3 py-1 rounded-md transition-all ${activeTab === 'settings' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            {t('common.settings', 'API Settings')}
                        </button>
                        <button
                            className={`px-3 py-1 rounded-md transition-all ${activeTab === 'analysis' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('analysis')}
                        >
                            {t('nav.analysis', 'Analysis')}
                        </button>
                        <button
                            onClick={() => setActiveTab('earn')}
                            className={`px-3 py-1 rounded-md transition-all ${activeTab === 'earn' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t('nav.earn_products', 'Earn', { ns: 'common' })}
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
                            <div className="md:col-span-2"> {/* Passphrase - Full width */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Passphrase (Optional)</label>
                                    <Input
                                        type="password"
                                        placeholder="Required for OKX, KuCoin etc."
                                        value={newConfig.password || ''}
                                        onChange={(e) => setNewConfig({ ...newConfig, password: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2"> {/* Fee Rates - Two columns */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Maker Fee (%)</label>
                                        <Input
                                            type="number"
                                            placeholder="e.g. 0.02"
                                            value={newConfig.makerFeeRate !== undefined ? newConfig.makerFeeRate : ''}
                                            onChange={(e) => setNewConfig({ ...newConfig, makerFeeRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Taker Fee (%)</label>
                                        <Input
                                            type="number"
                                            placeholder="e.g. 0.04"
                                            value={newConfig.takerFeeRate !== undefined ? newConfig.takerFeeRate : ''}
                                            onChange={(e) => setNewConfig({ ...newConfig, takerFeeRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-1 flex items-center">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={newConfig.enabled !== false}
                                        onCheckedChange={(checked) => setNewConfig({ ...newConfig, enabled: checked })}
                                    />
                                    <label className="text-sm font-medium">Enable Fetching</label>
                                </div>
                            </div>
                            <div className="md:col-span-1 flex gap-2">
                                <Button className="flex-1" onClick={handleSaveConfig} disabled={!newConfig.platformId || !newConfig.apiKey || !newConfig.apiSecret}>
                                    {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                    {editingId ? 'Update' : 'Add'}
                                </Button>
                                {editingId && (
                                    <Button variant="outline" onClick={handleCancelEdit}>
                                        Cancel
                                    </Button>
                                )}
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
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">{config.enabled !== false ? 'Enabled' : 'Disabled'}</span>
                                            <Switch
                                                checked={config.enabled !== false}
                                                onCheckedChange={(checked) => updateCexConfig(config.id, { enabled: checked })}
                                            />
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditConfig(config)}>
                                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => removeCexConfig(config.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
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

            {activeTab === 'analysis' && displayData && (
                <CexAnalysis cexData={displayData} hideAmounts={hideAmounts} />
            )}

            {activeTab === 'earn' && (
                <EarnProductsPanel />
            )}



            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Button onClick={fetchRealData} variant="outline" disabled={loading}>
                                <Database className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                {displayData ? t('cex.refresh_data_real', 'Refresh Data (Real)') : t('cex.load_data_real', 'Load Data (Real)')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowCny(!showCny)}
                                className="text-muted-foreground"
                            >
                                {showCny ? t('cex.switch_to_usd', 'Switch to USD') : t('cex.switch_to_cny', 'Switch to CNY')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleHideAmounts}
                                className="text-muted-foreground"
                            >
                                {hideAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {displayData && (
                        <>
                            <Card className="bg-primary text-primary-foreground">
                                <CardContent className="pt-6">
                                    <div className="text-sm opacity-80">{t('cex.total_balance', 'Total CEX Balance')}</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-4xl font-bold">{hideAmounts ? '****' : formatValue((displayData.totalUsd || 0) + manualAssetsTotal)}</div>
                                        {showCny && !hideAmounts && <div className="text-lg opacity-80">≈ {formatCurrency((displayData.totalUsd || 0) + manualAssetsTotal)}</div>}
                                    </div>
                                    {manualAssetsTotal > 0 && !hideAmounts && (
                                        <div className="text-xs opacity-60 mt-2">
                                            {t('common.api', 'API')}: {formatValue(displayData.totalUsd || 0)} + {t('common.manual', 'Manual')}: {formatValue(manualAssetsTotal)}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 gap-6">
                                {(() => {
                                    // Get sorted exchange entries based on custom order
                                    const exchanges = Object.entries(displayData.exchanges);
                                    const orderedExchanges = cexExchangeOrder.length > 0
                                        ? cexExchangeOrder
                                            .map(id => exchanges.find(([eid]) => eid === id))
                                            .filter(Boolean) as [string, any][]
                                        : exchanges;

                                    return orderedExchanges.map(([id, data]: [string, any]) => (
                                        <Card
                                            key={id}
                                            className={`overflow-hidden transition-opacity ${draggedId === id ? 'opacity-50' : ''}`}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, id)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, id)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleCard(id)}>
                                                <CardTitle className="flex justify-between items-center text-lg">
                                                    <div className="flex items-center gap-2">
                                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                                        {expandedCards[id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        {data.name}
                                                    </div>
                                                    <span>{hideAmounts ? '****' : formatValue(data.total)}</span>
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
                                                                {t('cex.sort_by_value', 'Sort by Value')} {sortDesc ? '↓' : '↑'}
                                                            </Button>
                                                        </div>
                                                        <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground mb-2 px-2">
                                                            <div className="col-span-1"></div>
                                                            <div className="col-span-3">Asset</div>
                                                            <div className="col-span-2">Type</div>
                                                            <div className="col-span-3 text-right">Price</div>
                                                            <div className="col-span-3 text-right">Value</div>
                                                        </div>
                                                        {data.balances
                                                            .sort((a: any, b: any) => sortDesc ? b.value - a.value : a.value - b.value)
                                                            .map((balance: any, idx: number) => {
                                                                // Normalize symbol (e.g. LDBNB -> BNB)
                                                                const displaySymbol = balance.symbol.startsWith('LD') && balance.symbol.length > 3
                                                                    ? balance.symbol.substring(2)
                                                                    : balance.symbol;

                                                                const monitored = isMonitored(displaySymbol);
                                                                const isAdding = addingToWatchlist[displaySymbol];

                                                                // Try to get image from monitored coins if available, else generic
                                                                const monitoredCoin = monitoredCoins.find(c => c.symbol.toLowerCase() === displaySymbol.toLowerCase());
                                                                const iconUrl = monitoredCoin?.image || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${displaySymbol.toLowerCase()}.png`;

                                                                return (
                                                                    <div key={idx} className="grid grid-cols-12 text-sm border-b last:border-0 py-2 px-2 items-center hover:bg-muted/50">
                                                                        <div className="col-span-1 flex justify-center">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0"
                                                                                onClick={(e) => toggleWatchlist(displaySymbol, e)}
                                                                                disabled={isAdding}
                                                                            >
                                                                                <Star className={`h-4 w-4 ${monitored ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'} ${isAdding ? 'animate-pulse' : ''}`} />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="col-span-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <TokenIcon symbol={displaySymbol} iconUrl={iconUrl} />
                                                                                <div>
                                                                                    <div className="font-medium flex items-center gap-1">
                                                                                        <a
                                                                                            href={getCoingeckoUrl(displaySymbol)}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="hover:text-blue-500 hover:underline cursor-pointer flex items-center gap-1"
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                        >
                                                                                            {displaySymbol}
                                                                                            <ExternalLink className="w-3 h-3 opacity-50" />
                                                                                        </a>
                                                                                    </div>
                                                                                    <div className="text-xs text-muted-foreground">{hideAmounts ? '****' : balance.amount.toFixed(4)}</div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="col-span-2 text-xs">
                                                                            <span className="bg-secondary px-2 py-1 rounded-full">
                                                                                {balance.type || 'Spot'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="col-span-3 text-right text-muted-foreground">
                                                                            {hideAmounts ? '****' : `${showCny ? '¥' : '$'}${(balance.price * (showCny ? CNY_RATE : 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                                                                        </div>
                                                                        <div className="col-span-3 text-right font-medium">
                                                                            {hideAmounts ? '****' : `${showCny ? '¥' : '$'}${(balance.value * (showCny ? CNY_RATE : 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </CardContent>
                                            )}
                                        </Card>
                                    ));
                                })()}

                                {/* Manual Assets Card */}
                                <Card className="border-border">
                                    <CardHeader
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => setManualAssetsExpanded(!manualAssetsExpanded)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="flex items-center gap-2">
                                                <Database className="h-5 w-5" />
                                                {t('manual_assets.title', '手动资产')}
                                            </CardTitle>
                                            <div className="flex items-center gap-3">
                                                <div className="text-lg font-bold">
                                                    {hideAmounts ? '****' : `${showCny ? '¥' : '$'}${(manualAssetsTotal * (showCny ? CNY_RATE : 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                </div>
                                                {manualAssetsExpanded ? (
                                                    <ChevronUp className="h-5 w-5" />
                                                ) : (
                                                    <ChevronDown className="h-5 w-5" />
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    {manualAssetsExpanded && (
                                        <CardContent className="pt-4">
                                            <ManualAssetsPanel />
                                        </CardContent>
                                    )}
                                </Card>
                            </div>
                        </>
                    )}
                </div >
            )}
        </div >
    );
};

const TokenIcon = ({ symbol, iconUrl }: { symbol: string, iconUrl?: string }) => {
    const [error, setError] = useState(false);

    if (error || !iconUrl) {
        return (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">
                    {symbol.slice(0, 1).toUpperCase()}
                </span>
            </div>
        );
    }

    return (
        <img
            src={iconUrl}
            alt={symbol}
            className="w-6 h-6 rounded-full shrink-0"
            onError={() => setError(true)}
        />
    );
};
