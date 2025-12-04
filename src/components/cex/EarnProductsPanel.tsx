import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Card, CardContent, CardHeader, CardTitle, Button, Switch } from '../ui';
import { TrendingUp, Loader2, AlertCircle, Filter } from 'lucide-react';
import { PlatformProducts } from '../../types';

export const EarnProductsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { cexConfigs, earnProducts, setEarnProducts, showHeldOnly, toggleShowHeldOnly, cexData } = useStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEarnProducts = async () => {
        setLoading(true);
        setError(null);
        const allProducts: PlatformProducts[] = [];

        try {
            for (const config of cexConfigs) {
                if (config.enabled === false) continue;

                try {
                    const response = await fetch('http://localhost:3001/api/cex/earn-products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            platformId: config.platformId,
                            apiKey: config.apiKey,
                            apiSecret: config.apiSecret,
                            password: config.password
                        })
                    });

                    if (!response.ok) throw new Error(`Failed to fetch from ${config.name || config.platformId}`);

                    const result = await response.json();
                    allProducts.push({
                        platform: config.name || result.platform,
                        platformId: config.platformId,
                        products: result.products
                    });
                } catch (err: any) {
                    console.error(`Failed to fetch earn products for ${config.name}:`, err);
                }
            }
            setEarnProducts(allProducts);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getEarnPageUrl = (platformId: string) => {
        const urls: Record<string, string> = {
            'okx': 'https://www.okx.com/earn',
            'binance': 'https://www.binance.com/en/earn',
            'bybit': 'https://www.bybit.com/en/earn',
            'kucoin': 'https://www.kucoin.com/earn',
        };
        return urls[platformId.toLowerCase()] || '#';
    };

    // Calculate held assets from cexData
    const heldAssets = useMemo(() => {
        const assets = new Set<string>();
        if (cexData && cexData.exchanges) {
            Object.values(cexData.exchanges).forEach((exchange: any) => {
                if (exchange.balances) {
                    exchange.balances.forEach((balance: any) => {
                        if (balance.amount > 0) {
                            // Normalize symbol (e.g. LDBNB -> BNB)
                            const displaySymbol = balance.symbol.startsWith('LD') && balance.symbol.length > 3
                                ? balance.symbol.substring(2)
                                : balance.symbol;
                            assets.add(displaySymbol.toUpperCase());
                        }
                    });
                }
            });
        }
        return assets;
    }, [cexData]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">{t('earn.title', 'Earn Products')}</h3>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={showHeldOnly}
                            onCheckedChange={toggleShowHeldOnly}
                            id="held-only-filter"
                        />
                        <label
                            htmlFor="held-only-filter"
                            className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1 select-none"
                        >
                            <Filter className="h-3 w-3" />
                            {t('earn.filter_held', 'Show Only Held Assets')}
                        </label>
                    </div>
                </div>
                <Button onClick={fetchEarnProducts} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                    {earnProducts.length > 0 ? t('earn.refresh_data', 'Refresh Data') : t('earn.load_products', 'Load Products')}
                </Button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {earnProducts.length === 0 && !loading && (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        {t('earn.no_products', 'Click button above to load earn products')}
                    </CardContent>
                </Card>
            )}

            {earnProducts.map((platformData) => {
                const filteredProducts = platformData.products.filter(p => {
                    // Filter by APR >= 1%
                    if (p.apr < 1) return false;
                    // Filter by Held Assets if enabled
                    if (showHeldOnly && !heldAssets.has(p.asset.toUpperCase())) return false;
                    return true;
                });

                if (filteredProducts.length === 0) return null;

                return (
                    <Card key={platformData.platform}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {platformData.platform}
                                <span className="text-sm font-normal text-muted-foreground">
                                    ({filteredProducts.length} {t('earn.products_count', 'products')})
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="text-left py-2 px-3">{t('earn.table.asset', 'Asset')}</th>
                                            <th className="text-left py-2 px-3">{t('earn.table.type', 'Type')}</th>
                                            <th className="text-right py-2 px-3">{t('earn.table.apr', 'APR')}</th>
                                            <th className="text-right py-2 px-3">{t('earn.table.daily_rate', 'Daily Rate')}</th>
                                            <th className="text-center py-2 px-3">{t('earn.table.can_purchase', 'Available')}</th>
                                            <th className="text-right py-2 px-3">{t('earn.table.min_amount', 'Min Amount')}</th>
                                            <th className="text-center py-2 px-3">{t('earn.table.action', 'Action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.map((product, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                                                <td className="py-2 px-3 font-medium">{product.asset}</td>
                                                <td className="py-2 px-3">
                                                    <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-xs">
                                                        {product.type === 'flexible' ? t('earn.type.flexible', 'Flexible') : t('earn.type.fixed', 'Fixed')}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3 text-right font-semibold text-green-600 dark:text-green-400">
                                                    {product.apr.toFixed(2)}%
                                                </td>
                                                <td className="py-2 px-3 text-right text-muted-foreground">
                                                    {(product.dailyRate * 100).toFixed(4)}%
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    {product.canPurchase ? (
                                                        <span className="text-green-600 dark:text-green-400">✓</span>
                                                    ) : (
                                                        <span className="text-red-600 dark:text-red-400">✗</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 text-right text-muted-foreground">
                                                    {product.minAmount !== null ? product.minAmount.toFixed(2) : '-'}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <a
                                                        href={getEarnPageUrl(platformData.platformId)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                                                    >
                                                        {t('earn.action.subscribe', 'Subscribe')} →
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
