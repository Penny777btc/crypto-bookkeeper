
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const BASE_URL = 'http://localhost:5174';

// Mock Data
const MOCK_STATE = {
    state: {
        monitoredCoins: [
            { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
            { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
            { id: 'solana', symbol: 'SOL', name: 'Solana' },
            { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
            { id: 'ripple', symbol: 'XRP', name: 'XRP' },
        ],
        prices: {
            'bitcoin': { usd: 65432.10, cny: 470000 },
            'ethereum': { usd: 3456.78, cny: 25000 },
            'solana': { usd: 145.67, cny: 1050 },
            'binancecoin': { usd: 320.50, cny: 2300 },
            'ripple': { usd: 0.65, cny: 4.7 },
            'tether': { usd: 1.00, cny: 7.25 },
            'usd-coin': { usd: 1.00, cny: 7.25 },
        },
        cexConfigs: [
            { id: '1', platformId: 'bybit', name: 'Bybit Main', apiKey: '***', apiSecret: '***', enabled: true },
            { id: '2', platformId: 'okx', name: 'OKX Trading', apiKey: '***', apiSecret: '***', enabled: true }
        ],
        cexData: {
            totalBalance: 20900.70,
            exchanges: {
                '1': {
                    name: 'Bybit Main',
                    totalBalance: 12500.50,
                    assets: [
                        { coin: 'USDT', free: 5000, used: 0, total: 5000, usdValue: 5000 },
                        { coin: 'BTC', free: 0.1, used: 0, total: 0.1, usdValue: 6543.21 },
                        { coin: 'ETH', free: 0.27, used: 0, total: 0.27, usdValue: 957.29 }
                    ]
                },
                '2': {
                    name: 'OKX Trading',
                    totalBalance: 8400.20,
                    assets: [
                        { coin: 'USDT', free: 3000, used: 0, total: 3000, usdValue: 3000 },
                        { coin: 'SOL', free: 37, used: 0, total: 37, usdValue: 5400.20 }
                    ]
                }
            }
        },
        manualAssets: [
            { id: 'm1', exchange: 'Binance', symbol: 'BNB', amount: 10, price: 320, value: 3200, note: 'Locked Staking', createdAt: 1704067200000, updatedAt: 1704067200000 },
            { id: 'm2', exchange: 'Metamask', symbol: 'USDC', amount: 5000, price: 1, value: 5000, note: 'DeFi Farm', createdAt: 1704153600000, updatedAt: 1704153600000 }
        ],
        transactions: [
            { id: 't1', type: 'Buy', platform: 'Binance', pair: 'BTC/USDT', amount: 0.1, price: 42000, value: 4200, fee: 5, date: '2024-01-01T10:00:00.000Z', pnl: 2343.21, intent: 'Long' },
            { id: 't2', type: 'Buy', platform: 'Bybit', pair: 'ETH/USDT', amount: 1.5, price: 2200, value: 3300, fee: 3.3, date: '2024-01-02T14:30:00.000Z', pnl: 1885.17, intent: 'Long' },
            { id: 't3', type: 'Sell', platform: 'OKX', pair: 'SOL/USDT', amount: 20, price: 110, value: 2200, fee: 2.2, date: '2024-01-03T09:15:00.000Z', pnl: 500, intent: 'Short' },
            { id: 't4', type: 'Buy', platform: 'Coinbase', pair: 'SOL/USD', amount: 50, price: 25, value: 1250, fee: 10, date: '2023-11-15T08:00:00.000Z', pnl: 6033.50, intent: 'Long' }
        ],
        aiConfig: { apiKey: '', provider: 'openai', baseUrl: '', model: '' }
    },
    version: 0
};

async function capture() {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR);
    }

    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('🌍 Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    console.log('💉 Injecting mock data...');
    await page.evaluate((mockData) => {
        localStorage.setItem('crypto-bookkeeper-storage', JSON.stringify(mockData));
    }, MOCK_STATE);

    console.log('🔄 Reloading to apply data...');
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 5000)); // Wait for render

    // 1. Dashboard Screenshot
    console.log('📸 Capturing Dashboard...');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dashboard.png'), fullPage: true });

    // 2. Manual Assets Screenshot
    console.log('📸 Capturing Manual Assets...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'manual-assets.png'), fullPage: true });

    // 3. Transactions Screenshot
    console.log('📸 Capturing Transactions...');
    await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 5000)); // Wait for render
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'transactions.png'), fullPage: true });

    // 4. AI Analysis Screenshot
    console.log('📸 Capturing AI Analysis...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 3000));

    // Try to click Analysis tab
    try {
        const buttons = await page.$$('button');
        for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text && (text.includes('Analysis') || text.includes('分析'))) {
                await button.click();
                await new Promise(r => setTimeout(r, 3000));
                await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'ai-analysis.png') });
                break;
            }
        }
    } catch (e) {
        console.error('Could not capture AI analysis tab:', e);
    }

    await browser.close();
    console.log('✅ Done!');
}

capture().catch(console.error);
