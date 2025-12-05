import { Transaction, ManualAsset, Wallet } from '../types';

/**
 * Demo data to populate the app on first run
 * This provides a complete demonstration of all features
 */

// Demo Transactions - 展示完整的交易记录和 PnL 计算
export const demoTransactions: Transaction[] = [
    {
        id: 'demo-tx-1',
        date: '2024-01-15T10:30:00.000Z',
        type: 'Buy',
        platform: 'Binance',
        pair: 'BTC/USDT',
        amount: 0.15,
        price: 42000,
        fee: 6.3,
        pnl: 3498.15,
        intent: 'Long',
        notes: '看好比特币长期趋势'
    },
    {
        id: 'demo-tx-2',
        date: '2024-01-20T14:15:00.000Z',
        type: 'Buy',
        platform: 'Bybit',
        pair: 'ETH/USDT',
        amount: 2,
        price: 2200,
        fee: 4.4,
        pnl: 2513.56,
        intent: 'Long',
        notes: '以太坊升级预期'
    },
    {
        id: 'demo-tx-3',
        date: '2024-02-01T09:00:00.000Z',
        type: 'Sell',
        platform: 'OKX',
        pair: 'SOL/USDT',
        amount: 50,
        price: 110,
        fee: 5.5,
        pnl: 1244.50,
        intent: 'Short',
        notes: '获利了结部分仓位'
    },
    {
        id: 'demo-tx-4',
        date: '2024-02-10T16:45:00.000Z',
        type: 'Buy',
        platform: 'Binance',
        pair: 'BNB/USDT',
        amount: 15,
        price: 280,
        fee: 4.2,
        pnl: 607.80,
        intent: 'Long',
        notes: 'Launchpad 活动'
    },
    {
        id: 'demo-tx-5',
        date: '2023-11-15T08:00:00.000Z',
        type: 'Buy',
        platform: 'Coinbase',
        pair: 'SOL/USD',
        amount: 100,
        price: 25,
        fee: 12.5,
        pnl: 12050,
        intent: 'Long',
        notes: '低价抄底'
    },
    {
        id: 'demo-tx-6',
        date: '2024-01-05T11:20:00.000Z',
        type: 'Buy',
        platform: 'OKX',
        pair: 'MATIC/USDT',
        amount: 500,
        price: 0.85,
        fee: 0.425,
        pnl: -42.50,
        intent: 'Long',
        notes: 'Layer2 生态布局'
    },
    {
        id: 'demo-tx-7',
        date: '2024-02-20T13:30:00.000Z',
        type: 'Sell',
        platform: 'Bybit',
        pair: 'BTC/USDT',
        amount: 0.05,
        price: 52000,
        fee: 2.6,
        pnl: 497.40,
        intent: 'Long',
        notes: '部分获利'
    },
    {
        id: 'demo-tx-8',
        date: '2024-03-01T15:00:00.000Z',
        type: 'Buy',
        platform: 'Binance',
        pair: 'ARB/USDT',
        amount: 1000,
        price: 1.2,
        fee: 1.2,
        pnl: -120,
        intent: 'Long',
        notes: 'Arbitrum 生态代币'
    }
];

// Demo Manual Assets - 展示手动添加的资产
export const demoManualAssets: Omit<ManualAsset, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
        exchange: 'Binance',
        symbol: 'BNB',
        amount: 20,
        note: 'Locked Staking (90天锁仓)'
    },
    {
        exchange: 'Metamask',
        symbol: 'USDC',
        amount: 5000,
        note: 'Aave V3 lending'
    },
    {
        exchange: 'Bybit',
        symbol: 'BBSOL',
        amount: 15,
        note: 'Bybit Staked SOL'
    }
];

// Demo Wallets - 展示链上钱包
export const demoWallets: Omit<Wallet, 'id'>[] = [
    {
        name: 'MetaMask 主钱包',
        chainType: 'evm',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        chains: ['ethereum', 'arbitrum', 'optimism'],
        tags: ['DeFi', '主力']
    },
    {
        name: 'Phantom 钱包',
        chainType: 'solana',
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        tags: ['NFT', 'Solana生态']
    }
];

// Demo CEX Data - 展示 CEX 资产（模拟数据）
export const demoCexData = {
    totalBalance: 22347.85,
    totalUsd: 22347.85,
    exchanges: {
        'demo-bybit': {
            name: 'Bybit (演示账户)',
            total: 13580.50,
            totalBalance: 13580.50,
            balances: [
                {
                    coin: 'USDT',
                    symbol: 'USDT',
                    free: 8000,
                    used: 0,
                    total: 8000,
                    amount: 8000,
                    price: 1,
                    value: 8000,
                    type: 'Spot'
                },
                {
                    coin: 'BTC',
                    symbol: 'BTC',
                    free: 0.1,
                    used: 0,
                    total: 0.1,
                    amount: 0.1,
                    price: 65432.10,
                    value: 6543.21,
                    type: 'Spot'
                },
                {
                    coin: 'ETH',
                    symbol: 'ETH',
                    free: 1.5,
                    used: 0.2,
                    total: 1.7,
                    amount: 1.7,
                    price: 3456.78,
                    value: 5876.53,
                    type: 'Spot'
                },
                {
                    coin: 'SOL',
                    symbol: 'SOL',
                    free: 50,
                    used: 0,
                    total: 50,
                    amount: 50,
                    price: 145.67,
                    value: 7283.50,
                    type: 'Funding'
                }
            ]
        },
        'demo-okx': {
            name: 'OKX (演示账户)',
            total: 8767.35,
            totalBalance: 8767.35,
            balances: [
                {
                    coin: 'USDT',
                    symbol: 'USDT',
                    free: 3000,
                    used: 500,
                    total: 3500,
                    amount: 3500,
                    price: 1,
                    value: 3500,
                    type: 'Trading'
                },
                {
                    coin: 'BNB',
                    symbol: 'BNB',
                    free: 10,
                    used: 0,
                    total: 10,
                    amount: 10,
                    price: 320.50,
                    value: 3205,
                    type: 'Funding'
                },
                {
                    coin: 'ARB',
                    symbol: 'ARB',
                    free: 1000,
                    used: 0,
                    total: 1000,
                    amount: 1000,
                    price: 1.15,
                    value: 1150,
                    type: 'Spot'
                },
                {
                    coin: 'MATIC',
                    symbol: 'MATIC',
                    free: 500,
                    used: 0,
                    total: 500,
                    amount: 500,
                    price: 0.82,
                    value: 410,
                    type: 'Spot'
                }
            ]
        }
    }
};

// Demo Monitored Coins - 价格监控列表
export const demoMonitoredCoins = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { id: 'solana', symbol: 'SOL', name: 'Solana' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano' }
];

// Demo Tags
export const demoTags = ['DeFi', 'NFT', 'Layer2', 'Staking', 'Trading'];
