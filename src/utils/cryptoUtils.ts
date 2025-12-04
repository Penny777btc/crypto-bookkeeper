
export const getCoingeckoUrl = (symbol: string) => {
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

export const getCoinId = (symbol: string): string | null => {
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
    return map[symbol.toUpperCase()] || null;
};

export const searchCoin = async (query: string) => {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${query}`);
        if (!response.ok) throw new Error('Failed to search coin');
        const data = await response.json();
        // Return the first exact match or the first result
        const exactMatch = data.coins.find((c: any) => c.symbol.toLowerCase() === query.toLowerCase());
        return exactMatch ? exactMatch.id : (data.coins[0]?.id || null);
    } catch (error) {
        console.error('Error searching coin:', error);
        return null;
    }
};

export const fetchMarketChart = async (coinId: string, days: string = '7') => {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
        if (!response.ok) throw new Error('Failed to fetch market chart');
        const data = await response.json();
        return data.prices; // Array of [timestamp, price]
    } catch (error) {
        console.error('Error fetching market chart:', error);
        return null;
    }
};

export const fetchCoinMarketData = async (coinId: string) => {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`);
        if (!response.ok) throw new Error('Failed to fetch coin data');
        const data = await response.json();
        return {
            current_price: data.market_data.current_price.usd,
            price_change_percentage_24h: data.market_data.price_change_percentage_24h,
            ath: data.market_data.ath.usd,
            ath_change_percentage: data.market_data.ath_change_percentage.usd,
            total_volume: data.market_data.total_volume.usd,
            market_cap: data.market_data.market_cap.usd
        };
    } catch (error) {
        console.error('Error fetching coin market data:', error);
        return null;
    }
};

export const fetchCoinNews = async (coinId: string) => {
    try {
        // CoinGecko news endpoint requires 'page' parameter
        const response = await fetch(`https://api.coingecko.com/api/v3/news?coins=${coinId}&page=1`);
        if (!response.ok) throw new Error('Failed to fetch news');
        const data = await response.json();
        return data.data.map((item: any) => ({
            title: item.title,
            url: item.url,
            description: item.description,
            date: item.created_at
        }));
    } catch (error) {
        console.error('Error fetching news:', error);
        return [];
    }
};
