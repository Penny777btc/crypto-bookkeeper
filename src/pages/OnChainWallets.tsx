import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Badge } from '../components/ui';
import { formatCurrency, formatCurrencyWithMask } from '../utils/utils';
import { exportToExcel, readExcel, downloadTemplate } from '../utils/excel';
import { Wallet as WalletIcon, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp, Copy, ExternalLink, Download, Upload, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { v4 as uuidv4 } from 'uuid';

// Chain Types
const CHAIN_TYPES = [
    { id: 'evm', name: 'EVM Compatible (ETH, BSC, etc.)' },
    { id: 'solana', name: 'Solana' },
    { id: 'bitcoin', name: 'Bitcoin' },
    { id: 'sui', name: 'Sui' },
];

const ChainGroup = ({ chain, total, balances, hideAmounts }: { chain: string, total: number, balances: any[], hideAmounts: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Split balances into Tokens and DeFi
    const tokens = balances.filter(b => !b.protocol);
    const defi = balances.filter(b => b.protocol);

    // Group DeFi by protocol
    const defiByProtocol: Record<string, any[]> = {};
    defi.forEach(b => {
        if (!defiByProtocol[b.protocol]) defiByProtocol[b.protocol] = [];
        defiByProtocol[b.protocol].push(b);
    });

    return (
        <div className="border rounded-md bg-background overflow-hidden">
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-medium capitalize">{chain}</span>
                    <Badge variant="secondary" className="text-[10px]">{balances.length}</Badge>
                </div>
                <div className="font-semibold text-sm">{hideAmounts ? '****' : formatCurrency(total)}</div>
            </div>

            {isOpen && (
                <div className="border-t divide-y">
                    {/* Tokens Section */}
                    {tokens.length > 0 && tokens.map((b: any, idx: number) => (
                        <div key={`token-${idx}`} className="flex justify-between items-center text-sm p-2 pl-8 hover:bg-muted/20">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{b.symbol}</span>
                                <span className="text-muted-foreground text-xs">({b.type || 'Token'})</span>
                            </div>
                            <div className="text-right">
                                <div>{hideAmounts ? '****' : (b.amount || 0).toFixed(4)}</div>
                                <div className="text-xs text-muted-foreground">{hideAmounts ? '****' : formatCurrency(b.value || 0)}</div>
                            </div>
                        </div>
                    ))}

                    {/* DeFi Section */}
                    {Object.entries(defiByProtocol).map(([protocol, items]) => (
                        <div key={protocol} className="bg-muted/10">
                            <div className="px-4 py-1 text-xs font-semibold text-muted-foreground bg-muted/20 flex justify-between">
                                <span>{protocol}</span>
                                <span>{hideAmounts ? '****' : formatCurrency(items.reduce((s, i) => s + (i.value || 0), 0))}</span>
                            </div>
                            {items.map((b: any, idx: number) => (
                                <div key={`defi-${idx}`} className="flex justify-between items-center text-sm p-2 pl-8 hover:bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">DeFi</Badge>
                                        <span className="font-medium">{b.symbol}</span>
                                        <span className="text-muted-foreground text-xs">(Deposit)</span>
                                    </div>
                                    <div className="text-right">
                                        <div>{hideAmounts ? '****' : (b.amount || 0).toFixed(4)}</div>
                                        <div className="text-xs text-muted-foreground">{hideAmounts ? '****' : formatCurrency(b.value || 0)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const OnChainWallets: React.FC = () => {
    const { wallets, addWallet, removeWallet, tags, addTag, walletData, setWalletData, hideAmounts, toggleHideAmounts } = useStore();
    const [activeTab, setActiveTab] = useState<'add' | 'overview'>('overview');

    // Add Wallet State
    const [newWallet, setNewWallet] = useState({
        name: '',
        chainType: 'evm',
        address: '',
        tags: [] as string[]
    });
    const [newTagInput, setNewTagInput] = useState('');

    // Overview State
    const [loading, setLoading] = useState(false);
    const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
    const [filterTag, setFilterTag] = useState<string>('all');
    const [filterChain, setFilterChain] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'default' | 'high-low' | 'low-high'>('high-low');
    const [refreshingWallets, setRefreshingWallets] = useState<Set<string>>(new Set());

    // ... (existing code) ...

    // Filter & Sort Logic
    const processedWallets = React.useMemo(() => {
        // 1. Filter
        let result = wallets.filter(w => {
            const matchTag = filterTag === 'all' || (w.tags && w.tags.includes(filterTag));
            const matchChain = filterChain === 'all' || w.chainType === filterChain;
            return matchTag && matchChain;
        });

        // 2. Sort
        if (sortOrder !== 'default') {
            result.sort((a, b) => {
                const totalA = walletData?.wallets?.[a.id]?.total || 0;
                const totalB = walletData?.wallets?.[b.id]?.total || 0;
                return sortOrder === 'high-low' ? totalB - totalA : totalA - totalB;
            });
        }

        return result;
    }, [wallets, filterTag, filterChain, sortOrder, walletData]);

    // ... (existing code) ...

    // --- Actions ---

    const handleAddTag = () => {
        const safeTags = tags || [];
        if (newTagInput && !safeTags.includes(newTagInput)) {
            addTag(newTagInput);
            setNewTagInput('');
        }
    };

    const toggleWalletTag = (tag: string) => {
        const currentTags = newWallet.tags || [];
        if (currentTags.includes(tag)) {
            setNewWallet({ ...newWallet, tags: currentTags.filter(t => t !== tag) });
        } else {
            setNewWallet({ ...newWallet, tags: [...currentTags, tag] });
        }
    };

    const handleAddWallet = () => {
        if (newWallet.name && newWallet.chainType && newWallet.address) {
            addWallet({
                id: uuidv4(),
                name: newWallet.name,
                chainType: newWallet.chainType,
                address: newWallet.address,
                tags: newWallet.tags || [],
                // Default chains for EVM, can be customized later if needed
                chains: newWallet.chainType === 'evm' ? ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base', 'avalanche'] : undefined
            });
            setNewWallet({ name: '', chainType: 'evm', address: '', tags: [] });
            setActiveTab('overview');
        }
    };

    // Helper for fetching balance
    const fetchWalletBalance = async (wallet: any) => {
        const chainType = wallet.chainType || wallet.chain || 'evm';
        const response = await fetch('http://localhost:3001/api/chain/balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chainType: chainType,
                address: wallet.address,
                chains: wallet.chains
            })
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const result = await response.json();

        if (!result || !Array.isArray(result.balances)) {
            throw new Error('Invalid balance data received');
        }

        let walletTotal = 0;
        const balances = result.balances.map((b: any) => {
            walletTotal += b.value;
            return b;
        });

        return { total: walletTotal, balances };
    };

    const fetchRealData = async () => {
        setLoading(true);
        const data: any = {
            totalUsd: 0,
            wallets: {}
        };

        try {
            for (const wallet of wallets) {
                try {
                    const { total, balances } = await fetchWalletBalance(wallet);
                    data.totalUsd += total;
                    data.wallets[wallet.id] = { total, balances };
                } catch (err) {
                    console.error(`Failed to fetch for ${wallet.name}: `, err);
                }
            }
            setWalletData(data);
        } catch (error) {
            console.error("Global fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const refreshWallet = async (walletId: string) => {
        const wallet = wallets.find(w => w.id === walletId);
        if (!wallet) return;

        setRefreshingWallets(prev => new Set(prev).add(walletId));

        try {
            const { total, balances } = await fetchWalletBalance(wallet);

            setWalletData((prev: any) => {
                const newData = { ...prev };
                // Ensure deep copy of wallets to avoid mutation
                newData.wallets = { ...(newData.wallets || {}) };

                // Subtract old total for this wallet if exists
                const oldWalletTotal = newData.wallets[walletId]?.total || 0;
                newData.totalUsd = (newData.totalUsd || 0) - oldWalletTotal + total;

                newData.wallets[walletId] = { total, balances };
                return newData;
            });

        } catch (err) {
            console.error(`Failed to refresh ${wallet.name}: `, err);
        } finally {
            setRefreshingWallets(prev => {
                const next = new Set(prev);
                next.delete(walletId);
                return next;
            });
        }
    };

    const removeWalletAndData = (id: string) => {
        removeWallet(id);
        // Optionally remove from walletData state too, but not strictly necessary as it won't be rendered
    };

    // Calculate Chain Totals & Grand Total
    const { chainTotals, grandTotal } = React.useMemo(() => {
        const cTotals: Record<string, number> = {};
        let gTotal = 0;

        if (!walletData || !walletData.wallets) return { chainTotals: cTotals, grandTotal: 0 };

        wallets.forEach(w => {
            const wData = walletData.wallets[w.id];
            if (wData) {
                const type = w.chainType || 'evm';
                const val = wData.total || 0;
                cTotals[type] = (cTotals[type] || 0) + val;
                gTotal += val;
            }
        });
        return { chainTotals: cTotals, grandTotal: gTotal };
    }, [walletData, wallets]);

    // --- Bulk Actions ---

    const handleExport = () => {
        const data = wallets.map(w => ({
            Name: w.name,
            'Chain Type': w.chainType,
            Address: w.address,
            Tags: (w.tags || []).join(', ')
        }));
        exportToExcel(data, 'my_wallets');
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await readExcel(file);
            let count = 0;
            let skipped = 0;

            // Use current wallets for duplicate check
            const currentWallets = useStore.getState().wallets;

            data.forEach((row: any) => {
                if (row.Name && row.Address) {
                    const address = row.Address.trim();
                    const chainType = row['Chain Type'] || 'evm';

                    // Check for duplicates (case-insensitive)
                    const exists = currentWallets.some(w =>
                        w.address.toLowerCase() === address.toLowerCase() &&
                        (w.chainType || 'evm') === chainType
                    );

                    if (!exists) {
                        addWallet({
                            id: uuidv4(),
                            name: row.Name,
                            chainType: chainType,
                            address: address,
                            tags: row.Tags ? row.Tags.split(',').map((t: string) => t.trim()) : [],
                            chains: chainType === 'evm' ? ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base', 'avalanche'] : undefined
                        });
                        count++;
                    } else {
                        skipped++;
                    }
                }
            });
            alert(`Imported ${count} wallets. Skipped ${skipped} duplicates.`);
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to import file. Please check the format.');
        } finally {
            // Reset input
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">On-chain Wallets</h2>
                <div className="flex gap-2">
                    {/* Hidden File Input */}
                    <input
                        type="file"
                        id="wallet-import"
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={handleImport}
                    />

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={downloadTemplate}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> Template
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => document.getElementById('wallet-import')?.click()}>
                            <Upload className="mr-2 h-4 w-4" /> Import
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" /> Export
                        </Button>
                    </div>

                    <div className="w-px bg-border mx-2 h-8"></div>

                    <Button
                        variant={activeTab === 'overview' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </Button>
                    <Button
                        variant={activeTab === 'add' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('add')}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Wallet
                    </Button>
                </div>
            </div>

            {activeTab === 'add' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Add New Wallet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Wallet Name</label>
                                <Input
                                    placeholder="e.g. Main Vault"
                                    value={newWallet.name}
                                    onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Chain Type</label>
                                <Select
                                    value={newWallet.chainType}
                                    onChange={(e) => setNewWallet({ ...newWallet, chainType: e.target.value })}
                                >
                                    {CHAIN_TYPES.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium mb-2 block">Wallet Address</label>
                                <Input
                                    placeholder="0x... or other format"
                                    value={newWallet.address}
                                    onChange={(e) => setNewWallet({ ...newWallet, address: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Tags Section */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Tags</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(tags || []).map(tag => (
                                    <Badge
                                        key={tag}
                                        variant={(newWallet.tags || []).includes(tag) ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => toggleWalletTag(tag)}
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2 max-w-xs">
                                <Input
                                    placeholder="New Tag..."
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                    className="h-8"
                                />
                                <Button size="sm" variant="outline" onClick={handleAddTag} disabled={!newTagInput}>Add</Button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button className="w-full md:w-auto" onClick={handleAddWallet} disabled={!newWallet.name || !newWallet.address}>
                                Save Wallet
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {/* Controls */}
                    <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Chain:</span>
                                <Select
                                    value={filterChain}
                                    onChange={(e) => setFilterChain(e.target.value)}
                                    className="w-32 h-8"
                                >
                                    <option value="all">All Chains</option>
                                    {CHAIN_TYPES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Tag:</span>
                                <Select
                                    value={filterTag}
                                    onChange={(e) => setFilterTag(e.target.value)}
                                    className="w-32 h-8"
                                >
                                    <option value="all">All Tags</option>
                                    {(tags || []).map(t => <option key={t} value={t}>{t}</option>)}
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Sort:</span>
                                <Select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value as any)}
                                    className="w-40 h-8"
                                >
                                    <option value="default">Default (Added)</option>
                                    <option value="high-low">Value (High-Low)</option>
                                    <option value="low-high">Value (Low-High)</option>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={fetchRealData} variant="outline" disabled={loading} size="sm">
                                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                {walletData ? 'Refresh Data' : 'Scan All Wallets'}
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

                    {/* Total Aggregated Balance */}
                    {walletData && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="md:col-span-3 bg-primary text-primary-foreground">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-sm opacity-80">Total Net Worth</div>
                                            <div className="text-4xl font-bold mt-2">{hideAmounts ? '****' : formatCurrency(grandTotal)}</div>
                                        </div>
                                        <div className="flex gap-4">
                                            {Object.entries(chainTotals).map(([chain, total]) => (
                                                <div key={chain} className="text-right min-w-[80px]">
                                                    <div className="text-xs font-medium opacity-80 uppercase">{chain}</div>
                                                    <div className="font-bold font-mono">{hideAmounts ? '****' : formatCurrency(total)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Wallets List */}
                    <div className="space-y-3">
                        {processedWallets.map(wallet => {
                            const currentWalletData = walletData?.wallets?.[wallet.id];
                            const isExpanded = expandedWallet === wallet.id;
                            const walletTags = wallet.tags || [];
                            const chainType = wallet.chainType || wallet.chain || 'evm';
                            const isRefreshing = refreshingWallets.has(wallet.id);

                            return (
                                <ErrorBoundary key={wallet.id} fallback={
                                    <div className="p-4 border border-red-200 bg-red-50 rounded-lg mb-3">
                                        <div className="font-semibold text-red-800">Error rendering wallet: {wallet.name}</div>
                                        <div className="text-xs text-red-600 mt-1">Please try removing and re-adding this wallet.</div>
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() => removeWalletAndData(wallet.id)}>Remove Wallet</Button>
                                    </div>
                                }>
                                    <Card className="overflow-hidden">
                                        <div
                                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => setExpandedWallet(isExpanded ? null : wallet.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-full ${chainType === 'evm' ? 'bg-blue-100 text-blue-600' : chainType === 'solana' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    <WalletIcon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold flex items-center gap-2">
                                                        {wallet.name}
                                                        {walletTags.map(t => (
                                                            <Badge key={t} variant="secondary" className="text-[10px] h-5 px-1.5">{t}</Badge>
                                                        ))}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}
                                                        <Copy className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={(e) => { e.stopPropagation(); /* Copy logic */ }} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className="font-bold">{hideAmounts ? '****' : (currentWalletData ? formatCurrency(currentWalletData.total) : '---')}</div>
                                                    <div className="text-xs text-muted-foreground uppercase">{chainType}</div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={(e) => { e.stopPropagation(); refreshWallet(wallet.id); }}
                                                    disabled={isRefreshing}
                                                >
                                                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                                                </Button>
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="border-t bg-muted/20 p-4">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="text-sm font-semibold">Assets</h4>
                                                    <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={(e) => { e.stopPropagation(); removeWalletAndData(wallet.id); }}>
                                                        <Trash2 className="mr-2 h-3 w-3" /> Remove Wallet
                                                    </Button>
                                                </div>

                                                {currentWalletData ? (
                                                    <div className="space-y-2">
                                                        {(() => {
                                                            // Group balances by chain
                                                            const groupedBalances: Record<string, any[]> = {};
                                                            (currentWalletData.balances || []).forEach((b: any) => {
                                                                const chain = b.chain || chainType;
                                                                if (!groupedBalances[chain]) groupedBalances[chain] = [];
                                                                groupedBalances[chain].push(b);
                                                            });

                                                            return Object.entries(groupedBalances).map(([chain, balances]) => {
                                                                const chainTotal = balances.reduce((sum, b) => sum + (b.value || 0), 0);
                                                                return (
                                                                    <ChainGroup key={chain} chain={chain} total={chainTotal} balances={balances} hideAmounts={hideAmounts} />
                                                                );
                                                            });
                                                        })()}
                                                        {currentWalletData.balances.length === 0 && <div className="text-sm text-muted-foreground text-center py-2">No assets found.</div>}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-muted-foreground text-center py-4">
                                                        Click "Scan All Wallets" to fetch data.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                </ErrorBoundary>
                            );
                        })}
                        {processedWallets.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                                No wallets found. {filterTag !== 'all' ? 'Try changing the tag filter.' : 'Add your first wallet!'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
