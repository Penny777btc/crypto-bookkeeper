/**
 * Calculate Simple Moving Average (SMA)
 * @param prices Array of prices (numbers)
 * @param period Period for SMA (e.g., 200)
 * @returns The last SMA value or null if not enough data
 */
export const calculateSMA = (prices: number[], period: number): number | null => {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
};

/**
 * Calculate Relative Strength Index (RSI)
 * @param prices Array of prices (numbers)
 * @param period Period for RSI (default 14)
 * @returns The last RSI value or null if not enough data
 */
export const calculateRSI = (prices: number[], period: number = 14): number | null => {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change >= 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate subsequent RSI values
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        let gain = 0;
        let loss = 0;
        if (change >= 0) {
            gain = change;
        } else {
            loss = -change;
        }

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};
