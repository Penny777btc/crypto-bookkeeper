
import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/ui';
import { formatCurrency } from '../utils/utils';
import { getCoingeckoUrl } from '../utils/cryptoUtils';
import { Trash2, RefreshCw, Search, Loader2, ExternalLink, ChevronDown, ChevronRight, Newspaper } from 'lucide-react';

// Simple Sparkline Component
const Sparkline = ({ data, color = '#2563eb' }: { data: number[], color?: string }) => {
    if (!data || data.length < 2) return null;

    // We only want the last 24h roughly. 
    // CoinGecko 7d sparkline has ~168 points (1 per hour). 
    // So last 24 points = 24h.
    const points = data.slice(-24);

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 100;
    const height = 30;

    const path = points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'} ${x},${y} `;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

interface NewsItem {
    title: string;
    description: string;
    url: string;
    author: string;
    news_site: string;
    thumb_2x: string;
    updated_at: number;
}

export const PriceMonitor: React.FC = () => {
    const { monitoredCoins, prices, addMonitoredCoin, removeMonitoredCoin, updatePrices } = useStore();
    const [loading, setLoading] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // News State
    const [expandedCoins, setExpandedCoins] = useState<Record<string, boolean>>({});
    const [newsData, setNewsData] = useState<Record<string, NewsItem[]>>({});
    const [loadingNews, setLoadingNews] = useState<Record<string, boolean>>({});

    // Fear and Greed State
    const [fngIndex, setFngIndex] = useState<{ value: string, value_classification: string } | null>(null);

    const fetchFng = async () => {
        try {
            const response = await fetch('https://api.alternative.me/fng/');
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                setFngIndex(data.data[0]);
            }
        } catch (error) {
            console.error("Failed to fetch Fear and Greed Index:", error);
        }
    };

    const fetchPrices = async () => {
        if (monitoredCoins.length === 0) return;

        setLoading(true);
        try {
            const ids = monitoredCoins.map(c => c.id).join(',');
            // Use coins/markets to get sparkline data
            const response = await fetch(
                `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true`
            );
            const data = await response.json();

            const newPrices: Record<string, any> = {};
            if (Array.isArray(data)) {
                data.forEach((coin: any) => {
                    newPrices[coin.id] = {
                        id: coin.id,
                        symbol: coin.symbol,
                        name: coin.name,
                        image: coin.image, // Store image from price fetch
                        current_price: coin.current_price,
                        price_change_percentage_24h: coin.price_change_percentage_24h,
                        sparkline_in_7d: coin.sparkline_in_7d // Store the sparkline object
                    };
                });
                updatePrices(newPrices);
            }
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

    const toggleNews = async (coinId: string) => {
        const isExpanded = !expandedCoins[coinId];
        setExpandedCoins(prev => ({ ...prev, [coinId]: isExpanded }));

        if (isExpanded && !newsData[coinId]) {
            setLoadingNews(prev => ({ ...prev, [coinId]: true }));
            try {
                // Find the coin details for filtering
                const coin = monitoredCoins.find(c => c.id === coinId);
                if (!coin) throw new Error("Coin not found");

                // Fetch news from our backend proxy (Google News RSS)
                const response = await fetch(`http://localhost:3001/api/news?q=${encodeURIComponent(coin.name)}`);
                const data = await response.json();

                if (data.data && Array.isArray(data.data)) {
                    // Map backend response to NewsItem format
                    const newsItems: NewsItem[] = data.data.map((item: any) => ({
                        title: item.title,
                        description: item.description,
                        url: item.url,
                        author: item.source,
                        news_site: item.source,
                        thumb_2x: '', // RSS doesn't provide thumbnails easily
                        updated_at: new Date(item.date).getTime() / 1000
                    }));
                    setNewsData(prev => ({ ...prev, [coinId]: newsItems }));
                }
            } catch (error) {
                console.error(`Failed to fetch news for ${coinId}:`, error);
            } finally {
                setLoadingNews(prev => ({ ...prev, [coinId]: false }));
            }
        }
    };

    useEffect(() => {
        fetchPrices();
        fetchFng();
        const interval = setInterval(fetchPrices, 60000); // Refresh every 60s
        return () => clearInterval(interval);
    }, [monitoredCoins]);

    const handleAddCoin = (coin: any) => {
        addMonitoredCoin({
            id: coin.id,
            symbol: coin.symbol,
            name: coin.name,
            image: coin.thumb // Save thumbnail from search result
        });
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    const getFngColor = (value: number) => {
        if (value >= 75) return 'text-green-600';
        if (value >= 50) return 'text-green-500';
        if (value >= 25) return 'text-orange-500';
        return 'text-red-600';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Price Monitor</h2>
                <div className="flex items-center gap-4">
                    {fngIndex && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-md shadow-sm">
                            <span className="text-sm font-medium text-muted-foreground">Fear & Greed:</span>
                            <span className={`font-bold ${getFngColor(parseInt(fngIndex.value))}`}>
                                {fngIndex.value}
                            </span>
                            <span className="text-xs text-muted-foreground">({fngIndex.value_classification})</span>
                        </div>
                    )}
                    <Button onClick={fetchPrices} variant="outline" disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
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
                                    <th className="p-4 w-[50px]"></th>
                                    <th className="p-4 font-medium">Asset</th>
                                    <th className="p-4 font-medium text-right">Price</th>
                                    <th className="p-4 font-medium text-center w-[150px]">24h Trend</th>
                                    <th className="p-4 font-medium text-right">24h Change</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monitoredCoins.map(coin => {
                                    const price = prices[coin.id];
                                    const isPositive = (price?.price_change_percentage_24h || 0) >= 0;
                                    const isExpanded = expandedCoins[coin.id];
                                    const news = newsData[coin.id];
                                    const isLoadingNews = loadingNews[coin.id];

                                    // Use image from price data (fresher) or coin metadata (fallback)
                                    const iconUrl = price?.image || coin.image;

                                    return (
                                        <React.Fragment key={coin.id}>
                                            <tr className="border-t hover:bg-muted/50 transition-colors">
                                                <td className="p-4 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => toggleNews(coin.id)}
                                                    >
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    </Button>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {iconUrl && (
                                                            <img src={iconUrl} alt={coin.symbol} className="w-8 h-8 rounded-full" />
                                                        )}
                                                        <div>
                                                            <div className="font-medium flex items-center gap-1">
                                                                <a
                                                                    href={getCoingeckoUrl(coin.symbol)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="hover:underline hover:text-blue-500 flex items-center gap-1"
                                                                >
                                                                    {coin.name}
                                                                    <ExternalLink className="w-3 h-3 opacity-50" />
                                                                </a>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground uppercase">{coin.symbol}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono">
                                                    {price?.current_price ? formatCurrency(price.current_price) : '---'}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {price?.sparkline_in_7d?.price && (
                                                        <Sparkline
                                                            data={price.sparkline_in_7d.price}
                                                            color={isPositive ? '#16a34a' : '#dc2626'}
                                                        />
                                                    )}
                                                </td>
                                                <td className={`p-4 text-right font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
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
                                            {isExpanded && (
                                                <tr className="bg-muted/20">
                                                    <td colSpan={6} className="p-4">
                                                        <div className="pl-10">
                                                            {isLoadingNews ? (
                                                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                    Fetching news...
                                                                </div>
                                                            ) : news && news.length > 0 ? (
                                                                <div className="grid gap-3">
                                                                    {news.map((item, idx) => (
                                                                        <a
                                                                            key={idx}
                                                                            href={item.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="block p-3 rounded-md border bg-card hover:bg-accent transition-colors group"
                                                                        >
                                                                            <div className="flex justify-between items-start gap-4">
                                                                                <div>
                                                                                    <h5 className="font-medium text-sm group-hover:text-blue-500 transition-colors line-clamp-1">
                                                                                        {item.title}
                                                                                    </h5>
                                                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                                                        {item.description}
                                                                                    </p>
                                                                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                                                                                        <span className="font-medium text-primary/80">{item.news_site || 'Unknown Source'}</span>
                                                                                        <span>•</span>
                                                                                        <span>{new Date(item.updated_at * 1000).toLocaleDateString()}</span>
                                                                                    </div>
                                                                                </div>
                                                                                {item.thumb_2x && (
                                                                                    <img src={item.thumb_2x} alt="News" className="w-16 h-16 object-cover rounded-md shrink-0" />
                                                                                )}
                                                                            </div>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-muted-foreground py-2">
                                                                    No recent news found.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {monitoredCoins.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
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
