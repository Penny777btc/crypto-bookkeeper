import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../ui';
import { useStore } from '../../store/useStore';
import { Sparkles } from 'lucide-react';
import { PortfolioAnalysisSheet } from '../ai/PortfolioAnalysisSheet';
import { fetchCoinGeckoPrices } from '../../utils/coinGecko';

interface CexAnalysisProps {
    cexData: {
        totalUsd: number;
        exchanges: Record<string, any>;
    };
    hideAmounts: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#a4de6c', '#d0ed57'];

// Map coin symbols to CoinGecko IDs
const symbolToCoinGeckoId: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'BNB': 'binancecoin',
    'ADA': 'cardano',
    'OKB': 'okb',
    'TON': 'the-open-network',
    'SUI': 'sui',
    'MNT': 'mantle',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'BBSOL': 'bybit-staked-sol',
    'MXC': 'mxc',
};

// Simple Sparkline Component (Copied from PriceMonitor)
const Sparkline = ({ data, color = '#2563eb' }: { data: number[], color?: string }) => {
    if (!data || data.length < 2) return null;

    const points = data.slice(-24); // Last 24 points (approx 24h)
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

export const CexAnalysis: React.FC<CexAnalysisProps> = ({ cexData, hideAmounts }) => {
    const { prices: monitoredPrices, monitoredCoins, manualAssets } = useStore();
    const [analysisPrices, setAnalysisPrices] = useState<Record<string, any>>({});
    const [manualAssetsPrices, setManualAssetsPrices] = useState<Record<string, number>>({});
    const [isPortfolioSheetOpen, setIsPortfolioSheetOpen] = useState(false);

    // Fetch prices for manual assets
    useEffect(() => {
        const fetchManualPrices = async () => {
            if (manualAssets.length === 0) return;

            const symbols = [...new Set(manualAssets.map(a => a.symbol.toUpperCase()))];


            const coinGeckoIds = symbols
                .map(symbol => symbolToCoinGeckoId[symbol] || symbol.toLowerCase())
                .join(',');

            try {
                const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds}&vs_currencies=usd`);
                const data = await response.json();

                const priceMap: Record<string, number> = {};
                symbols.forEach(symbol => {
                    const cgId = symbolToCoinGeckoId[symbol] || symbol.toLowerCase();
                    if (data[cgId] && data[cgId].usd) {
                        priceMap[symbol] = data[cgId].usd;
                    }
                });

                setManualAssetsPrices(priceMap);
            } catch (error) {
                console.error('Failed to fetch manual assets prices for Analysis:', error);
            }
        };

        fetchManualPrices();
    }, [manualAssets]);

    const data = useMemo(() => {
        const tokenMap = new Map<string, number>();

        // Add CEX exchange balances
        Object.values(cexData.exchanges).forEach((exchange: any) => {
            if (exchange.balances) {
                exchange.balances.forEach((balance: any) => {
                    const value = balance.value || (balance.amount * balance.price) || 0;
                    if (value > 0) {
                        const coin = balance.symbol || 'Unknown';
                        tokenMap.set(coin, (tokenMap.get(coin) || 0) + value);
                    }
                });
            }
        });

        // Add manual assets
        manualAssets.forEach(asset => {
            const price = manualAssetsPrices[asset.symbol.toUpperCase()] || 0;
            if (price > 0) {
                const value = asset.amount * price;
                tokenMap.set(asset.symbol.toUpperCase(), (tokenMap.get(asset.symbol.toUpperCase()) || 0) + value);
            }
        });

        const result = Array.from(tokenMap.entries())
            .map(([name, value]) => ({ name, value }))
            .filter(item => item.value >= 100) // Filter out small assets (< $100)
            .sort((a, b) => b.value - a.value);

        return result;
    }, [cexData, manualAssets, manualAssetsPrices]);

    // Fetch prices for all unique symbols
    useEffect(() => {
        const fetchPrices = async () => {
            const symbols = data.map(item => item.name);
            if (symbols.length === 0) return;

            const priceMap = await fetchCoinGeckoPrices(symbols);
            setAnalysisPrices(priceMap);
        };

        fetchPrices();
    }, [data]);

    const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);

    const formatCurrency = (value: number) => {
        if (hideAmounts) return '****';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        if (percent < 0.05) return null; // Don't show label for small slices

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    const portfolioData = data.map(item => ({
        ...item,
        percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0
    }));

    return (
        <div className="space-y-6">
            <PortfolioAnalysisSheet
                isOpen={isPortfolioSheetOpen}
                onClose={() => setIsPortfolioSheetOpen(false)}
                data={portfolioData}
                totalValue={totalValue}
            />

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Portfolio Distribution</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => setIsPortfolioSheetOpen(true)}
                        >
                            <Sparkles className="h-4 w-4" />
                            Ask AI
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomLabel}
                                    outerRadius={150}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {data.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Asset Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-3 font-medium">Asset</th>
                                    <th className="p-3 font-medium text-right">Price</th>
                                    <th className="p-3 font-medium text-right">24h Change</th>
                                    <th className="p-3 font-medium text-center">Trend (7d)</th>
                                    <th className="p-3 font-medium text-right">Allocation</th>
                                    <th className="p-3 font-medium text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((item, index) => {
                                    // Try Analysis prices first, fallback to monitored prices
                                    const priceData = analysisPrices[item.name];
                                    const monitoredCoin = monitoredCoins.find(c => c.symbol.toLowerCase() === item.name.toLowerCase());
                                    const fallbackPriceData = monitoredCoin ? monitoredPrices[monitoredCoin.id] : null;

                                    const finalPriceData = priceData || fallbackPriceData;
                                    const sparklineData = finalPriceData?.sparkline_in_7d?.price;
                                    const priceChange = finalPriceData?.price_change_percentage_24h || 0;
                                    const isPositive = priceChange >= 0;

                                    return (
                                        <tr key={item.name} className="border-t hover:bg-muted/50 transition-colors">
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                    <span className="font-medium">{item.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right text-sm">
                                                {finalPriceData?.current_price ? formatCurrency(finalPriceData.current_price) : <span className="text-muted-foreground">-</span>}
                                            </td>
                                            <td className={`p-3 text-right text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                {priceChange !== 0 ? (
                                                    <>
                                                        {isPositive ? '+' : ''}
                                                        {priceChange.toFixed(2)}%
                                                    </>
                                                ) : <span className="text-muted-foreground">-</span>}
                                            </td>
                                            <td className="p-3 text-center">
                                                {sparklineData ? (
                                                    <div className="flex justify-center">
                                                        <Sparkline
                                                            data={sparklineData}
                                                            color={isPositive ? '#16a34a' : '#dc2626'}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">---</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className="text-muted-foreground">
                                                    {((item.value / totalValue) * 100).toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-bold">
                                                {formatCurrency(item.value)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
