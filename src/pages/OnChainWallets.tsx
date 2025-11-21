import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { CONFIG } from '../config/config';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '../components/ui';
import { formatCurrency } from '../utils/utils';
import { Trash2, Plus, Wallet as WalletIcon, ExternalLink, Copy } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const OnChainWallets: React.FC = () => {
    const { wallets, addWallet, removeWallet } = useStore();
    const [newWallet, setNewWallet] = useState({ name: '', chain: '', address: '' });
    const [mockData, setMockData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleAddWallet = () => {
        if (newWallet.name && newWallet.chain && newWallet.address) {
            addWallet({
                id: uuidv4(),
                ...newWallet
            });
            setNewWallet({ name: '', chain: '', address: '' });
        }
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
                    const response = await fetch('http://localhost:3001/api/chain/balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chain: wallet.chain,
                            address: wallet.address
                        })
                    });

                    if (!response.ok) throw new Error('Failed to fetch');

                    const result = await response.json();

                    // Calculate USD value using CoinGecko prices from store if available
                    // For native coins (ETH, SOL, etc.), we might not have price if not monitored.
                    // We will try to match symbol.

                    let walletTotal = 0;
                    const balancesWithPrice = result.balances.map((b: any) => {
                        // Simplistic price matching
                        // In a real app, we would fetch prices for these specific symbols
                        let price = 0;
                        // Fallback for major coins if not in store (just for better UX in this demo)
                        if (b.symbol === 'ETH') price = 3500;
                        if (b.symbol === 'BTC') price = 65000;
                        if (b.symbol === 'SOL') price = 150;
                        if (b.symbol === 'BNB') price = 600;
                        if (b.symbol === 'MATIC') price = 0.7;

                        // If we have it in store, use that (it's fresher)
                        // We need to find the coin ID for the symbol.
                        // This is hard without a map.

                        const value = b.amount * price;
                        walletTotal += value;

                        return { ...b, price, value };
                    });

                    data.totalUsd += walletTotal;
                    data.wallets[wallet.id] = {
                        total: walletTotal,
                        balances: balancesWithPrice
                    };

                } catch (err) {
                    console.error(`Failed to fetch for ${wallet.name}:`, err);
                }
            }
            setMockData(data);
        } catch (error) {
            console.error("Global fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">On-chain Wallets</h2>
                <Button onClick={fetchRealData} variant="outline" disabled={loading}>
                    <WalletIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    {mockData ? 'Refresh On-chain Data (Real)' : 'Scan Wallets (Real)'}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Wallets</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-end">
                        <div className="md:col-span-1">
                            <label className="text-sm font-medium mb-2 block">Chain</label>
                            <Select
                                value={newWallet.chain}
                                onChange={(e) => setNewWallet({ ...newWallet, chain: e.target.value })}
                            >
                                <option value="">Select Chain</option>
                                {CONFIG.chains.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm font-medium mb-2 block">Wallet Name</label>
                            <Input
                                placeholder="Main Wallet"
                                value={newWallet.name}
                                onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm font-medium mb-2 block">Address</label>
                            <Input
                                placeholder="0x..."
                                value={newWallet.address}
                                onChange={(e) => setNewWallet({ ...newWallet, address: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <Button className="w-full" onClick={handleAddWallet} disabled={!newWallet.chain || !newWallet.name || !newWallet.address}>
                                <Plus className="mr-2 h-4 w-4" /> Add Wallet
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {wallets.map(wallet => (
                            <div key={wallet.id} className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow relative group">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeWallet(wallet.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 rounded-full bg-secondary text-xs font-medium">
                                        {CONFIG.chains.find(c => c.id === wallet.chain)?.name}
                                    </span>
                                    <h4 className="font-semibold">{wallet.name}</h4>
                                </div>

                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                    <span className="truncate font-mono bg-muted px-1 rounded">{wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}</span>
                                    <Copy className="h-3 w-3 cursor-pointer hover:text-foreground" />
                                    <ExternalLink className="h-3 w-3 cursor-pointer hover:text-foreground" />
                                </div>

                                {mockData && mockData.wallets[wallet.id] && (
                                    <div className="mt-4 pt-4 border-t">
                                        <div className="text-2xl font-bold mb-2">
                                            {formatCurrency(mockData.wallets[wallet.id].total)}
                                        </div>
                                        <div className="space-y-1">
                                            {mockData.wallets[wallet.id].balances.map((b: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-xs">
                                                    <span>{b.amount.toFixed(4)} {b.symbol}</span>
                                                    <span className="text-muted-foreground">{formatCurrency(b.amount * b.price)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {wallets.length === 0 && (
                            <div className="col-span-full text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                                No wallets added. Add your first wallet to track on-chain assets.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
