import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/ui';
import { formatCurrency } from '../utils/utils';
import { Trash2, RefreshCw, Search, Loader2 } from 'lucide-react';

export const PriceMonitor: React.FC = () => {
    const { monitoredCoins, prices, addMonitoredCoin, removeMonitoredCoin, updatePrices } = useStore();
    const [loading, setLoading] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    const fetchPrices = async () => {
        if (monitoredCoins.length === 0) return;

        setLoading(true);
        try {
            const ids = monitoredCoins.map(c => c.id).join(',');
            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
            );
            const data = await response.json();

            const newPrices: Record<string, any> = {};
            monitoredCoins.forEach(coin => {
                if (data[coin.id]) {
                    newPrices[coin.id] = {
                        id: coin.id,
                        symbol: coin.symbol,
                        name: coin.name,
                        current_price: data[coin.id].usd,
                        price_change_percentage_24h: data[coin.id].usd_24h_change
                    };
                }
            });
            updatePrices(newPrices);
        } catch (error) {
            console.error("Failed to fetch prices:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${searchQuery}`);
            const data = await response.json();
            setSearchResults(data.coins || []);
            setSearchOpen(true);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 60000); // Refresh every 60s
        return () => clearInterval(interval);
    }, [monitoredCoins]);

    const handleAddCoin = (coin: any) => {
        addMonitoredCoin({
            id: coin.id,
            symbol: coin.symbol,
            name: coin.name
        });
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Price Monitor</h2>
                <Button onClick={fetchPrices} variant="outline" disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Watchlist</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 mb-6 relative">
                        <div className="relative flex-1 max-w-md">
                            <Input
                                placeholder="Search token (e.g. PEPE, WIF)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            {searchOpen && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto">
                                    {searchResults.map(coin => (
                                        <div
                                            key={coin.id}
                                            className="p-3 hover:bg-accent cursor-pointer flex items-center gap-3"
                                            onClick={() => handleAddCoin(coin)}
                                        >
                                            <img src={coin.thumb} alt={coin.symbol} className="w-6 h-6 rounded-full" />
                                            <div>
                                                <div className="font-medium">{coin.name}</div>
                                                <div className="text-xs text-muted-foreground">{coin.symbol}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button onClick={handleSearch} disabled={isSearching || !searchQuery}>
                            {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Search
                        </Button>
                    </div>

                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-4 font-medium">Asset</th>
                                    <th className="p-4 font-medium text-right">Price</th>
                                    <th className="p-4 font-medium text-right">24h Change</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monitoredCoins.map(coin => {
                                    const price = prices[coin.id];
                                    return (
                                        <tr key={coin.id} className="border-t hover:bg-muted/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-medium">{coin.name}</div>
                                                <div className="text-xs text-muted-foreground">{coin.symbol}</div>
                                            </td>
                                            <td className="p-4 text-right font-mono">
                                                {price?.current_price ? formatCurrency(price.current_price) : '---'}
                                            </td>
                                            <td className={`p-4 text-right font-mono ${(price?.price_change_percentage_24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {price?.price_change_percentage_24h ? `${price.price_change_percentage_24h.toFixed(2)}%` : '---'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => removeMonitoredCoin(coin.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {monitoredCoins.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                            No coins monitored. Search and add one above.
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
