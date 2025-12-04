// CoinGecko ID mapping for common crypto symbols
export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
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
    'XRP': 'ripple',
    'DOGE': 'dogecoin',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'LTC': 'litecoin',
    'AVAX': 'avalanche-2',
    'UNI': 'uniswap'
};

/**
 * Get CoinGecko ID for a symbol
 * @param symbol - Token symbol (e.g., 'BTC', 'ETH')
 * @returns CoinGecko ID or lowercase symbol as fallback
 */
export function getCoinGeckoId(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    return SYMBOL_TO_COINGECKO_ID[upperSymbol] || symbol.toLowerCase();
}

/**
 * Fetch prices for multiple symbols from CoinGecko
 * @param symbols - Array of token symbols
 * @returns Record of symbol to USD price
 */
export async function fetchCoinGeckoPrices(symbols: string[]): Promise<Record<string, number>> {
    if (symbols.length === 0) return {};

    const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
    const coinGeckoIds = uniqueSymbols
        .map(symbol => getCoinGeckoId(symbol))
        .join(',');

    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds}&vs_currencies=usd`
        );
        const data = await response.json();

        const priceMap: Record<string, number> = {};
        uniqueSymbols.forEach(symbol => {
            const cgId = getCoinGeckoId(symbol);
            if (data[cgId] && data[cgId].usd) {
                priceMap[symbol] = data[cgId].usd;
            }
        });

        return priceMap;
    } catch (error) {
        console.error('Failed to fetch CoinGecko prices:', error);
        return {};
    }
}
