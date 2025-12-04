import express from 'express';
import cors from 'cors';
import ccxt from 'ccxt';
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { fetchAaveV3Balances } from './defi/aaveV3.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- News Proxy ---
app.get('/api/news', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });

    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+crypto&hl=en-US&gl=US&ceid=US:en`;
        const response = await fetch(rssUrl);
        const xmlText = await response.text();

        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xmlText)) !== null) {
            const content = match[1];
            const title = content.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const link = content.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
            const source = content.match(/<source.*?>([\s\S]*?)<\/source>/)?.[1] || '';

            // Clean up title (Google News often has " - Source" at the end)
            const cleanTitle = title.replace(/ - .*$/, '');

            items.push({
                title: cleanTitle,
                url: link,
                description: '', // RSS feed often doesn't have good description, title is usually enough
                date: pubDate,
                source: source
            });
        }

        res.json({ data: items.slice(0, 5) }); // Return top 5
    } catch (error) {
        console.error('News fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// --- CEX Endpoints ---

app.post('/api/cex/balance', async (req, res) => {
    const { platformId, apiKey, apiSecret, password } = req.body;

    if (!platformId || !apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    console.log(`[API] Fetching balance for ${platformId}. Key: ${apiKey ? '***' : 'MISSING'}, Secret: ${apiSecret ? '***' : 'MISSING'}, Password: ${password ? '***' : 'MISSING'}`);

    try {
        if (!ccxt[platformId]) {
            return res.status(400).json({ error: `Exchange ${platformId} not supported by ccxt` });
        }

        const exchange = new ccxt[platformId]({
            apiKey: apiKey,
            secret: apiSecret,
            password: password, // Standard ccxt property
            passphrase: password, // Alias often used by OKX specifically
            enableRateLimit: true,
        });

        const balances = []; // This will store all processed balance items
        const accountSignatures = new Set(); // To detect duplicate account views

        // Helper to process balance
        const processBalance = (bal, type) => {
            // Try to find total equity/value from the exchange response
            let exchangeReportedTotal = 0;
            if (bal.info?.result?.list?.[0]?.totalEquity) {
                exchangeReportedTotal = parseFloat(bal.info.result.list[0].totalEquity);
            }

            // DUPLICATE DETECTION:
            const assets = [];
            Object.keys(bal).forEach(key => {
                // BINANCE FIX: Filter out LD* assets (Simple Earn wrapped tokens)
                // Safety check: Ensure we don't filter out real tokens like LDO (Lido DAO)
                // LD assets are usually LD + Symbol (e.g. LDBNB, LDUSDT), so length > 3 is a safe heuristic for now (LDO is 3)
                if (platformId.toLowerCase() === 'binance' && key.startsWith('LD') && key.length > 3) {
                    return;
                }

                // Filter out metadata keys
                if (['info', 'free', 'used', 'total', 'timestamp', 'datetime'].includes(key)) {
                    return;
                }

                // Safety check for valid balance object
                if (!bal[key] || typeof bal[key] !== 'object') {
                    return;
                }

                const total = bal[key].total;
                if (total > 0) {
                    assets.push(`${key}:${parseFloat(total.toFixed(6))}`);
                }
            });
            const signature = assets.sort().join('|');

            // Deduplication check (skip if this exact balance state was already seen)
            // EXCEPTION: Always process 'Bybit Dual Asset' to debug why it's empty
            if (accountSignatures.has(signature) && type !== 'Bybit Dual Asset') {
                console.log(`[${platformId}] Skipping duplicate account view for ${type} (Signature match)`);
                return;
            }
            if (signature) accountSignatures.add(signature);

            console.log(`[${platformId}] Processing ${type}. Assets: ${assets.length}`);

            // Helper to find raw item in info for usdValue (Bybit specific)
            const findRawItem = (code) => {
                // Standard Bybit Spot/Unified structure
                if (bal.info?.result?.list?.[0]?.coin && Array.isArray(bal.info.result.list[0].coin)) {
                    return bal.info.result.list[0].coin.find(c => c.coin === code);
                }
                // Bybit Earn / Raw List structure
                if (bal.info?.result?.list && Array.isArray(bal.info.result.list)) {
                    // Check if the list itself contains the items (Earn structure)
                    const found = bal.info.result.list.find(c => c.coin === code || c.currency === code || c.token === code);
                    if (found) return found;
                }
                // Fallback for other structures
                if (Array.isArray(bal.info?.result?.list)) {
                    return bal.info.result.list.find(c => c.coin === code || c.currency === code);
                }
                return null;
            };

            Object.keys(bal).forEach(key => {
                // BINANCE FIX: Filter out LD* assets here as well
                if (platformId.toLowerCase() === 'binance' && key.startsWith('LD') && key.length > 3) {
                    return;
                }

                if (['info', 'free', 'used', 'total', 'timestamp', 'datetime'].includes(key)) {
                    return;
                }

                // Safety check
                if (!bal[key] || typeof bal[key] !== 'object') {
                    return;
                }

                const total = bal[key].total;
                if (total > 0) {
                    let usdValue = 0;
                    let price = 0;

                    const rawItem = findRawItem(key);
                    if (rawItem && rawItem.usdValue) {
                        usdValue = parseFloat(rawItem.usdValue);
                        if (total > 0) price = usdValue / total;
                    }

                    balances.push({
                        coin: key,
                        amount: total,
                        type: type,
                        rawUsdValue: usdValue,
                        price: price
                    });
                }
            });
        };

        // 0. Load Markets (Crucial for fetchTickers and symbol normalization)
        try {
            await exchange.loadMarkets();
        } catch (e) {
            console.log(`Load markets failed: ${e.message}`);
        }

        // 1. Fetch Balances
        // Default Spot/Unified
        try {
            const balance = await exchange.fetchBalance();

            // BINANCE DEBUG & FIX
            if (platformId.toLowerCase() === 'binance') {
                // Filter out LD* assets (Simple Earn wrapped tokens)
                Object.keys(balance).forEach(key => {
                    if (key.startsWith('LD') && key.length > 3) {
                        // console.log(`[Binance] Filtering out Spot asset: ${key}`);
                        delete balance[key];
                    }
                });
            }

            processBalance(balance, 'Spot/Unified');
        } catch (e) {
            console.error('Fetch balance failed:', e.message);
        }

        // OKX Special Handling
        if (platformId.toLowerCase() === 'okx') {
            try {
                console.log(`[OKX] Fetching Funding Account...`);
                // OKX Funding Account
                const funding = await exchange.fetchBalance({ type: 'funding' });
                processBalance(funding, 'Funding');
            } catch (e) {
                console.log(`[OKX] Fetch Funding failed: ${e.message}`);
            }

            try {
                console.log(`[OKX] Fetching Trading Account...`);
                // OKX Trading Account (Unified)
                const trading = await exchange.fetchBalance({ type: 'trading' });
                processBalance(trading, 'Trading');
            } catch (e) {
                console.log(`[OKX] Fetch Trading failed: ${e.message}`);
            }

            try {
                console.log(`[OKX] Fetching Earn (Finance) Account...`);
                // Try standard CCXT first
                try {
                    const earn = await exchange.fetchBalance({ type: 'earn' });
                    processBalance(earn, 'Earn');
                } catch (e) {
                    console.log(`[OKX] Standard Earn fetch failed: ${e.message}`);
                }

                // Try Raw API: Simple Earn (Savings)
                if (exchange.privateGetFinanceSavingsBalance) {
                    console.log(`[OKX] Fetching Simple Earn (Raw)...`);
                    try {
                        const res = await exchange.privateGetFinanceSavingsBalance();
                        console.log(`[OKX] Simple Earn Raw Response:`, JSON.stringify(res));

                        if (res.data && Array.isArray(res.data)) {
                            const manualBal = { info: res };
                            let found = false;
                            res.data.forEach(item => {
                                const coin = item.ccy;
                                const amount = parseFloat(item.amt);
                                if (amount > 0) {
                                    manualBal[coin] = { total: amount };
                                    found = true;
                                }
                            });
                            if (found) processBalance(manualBal, 'OKX Simple Earn');
                        }
                    } catch (e) {
                        console.log(`[OKX] Simple Earn Raw failed: ${e.message}`);
                    }
                }

                // Try Raw API: On-chain Earn (Staking/DeFi)
                if (exchange.privateGetFinanceStakingDefiOrdersActive) {
                    console.log(`[OKX] Fetching Staking/DeFi (Raw)...`);
                    try {
                        const res = await exchange.privateGetFinanceStakingDefiOrdersActive();
                        console.log(`[OKX] Staking/DeFi Raw Response:`, JSON.stringify(res));

                        if (res.data && Array.isArray(res.data)) {
                            const manualBal = { info: res };
                            let found = false;
                            res.data.forEach(item => {
                                const coin = item.ccy;
                                const amount = parseFloat(item.amt);
                                if (amount > 0) {
                                    manualBal[coin] = { total: amount };
                                    found = true;
                                }
                            });
                            if (found) processBalance(manualBal, 'OKX Staking/DeFi');
                        }
                    } catch (e) {
                        console.log(`[OKX] Staking/DeFi Raw failed: ${e.message}`);
                    }
                }

                // Try Raw API: Structured Products (SFP)
                let sfpPermissionError = false;
                if (exchange.privateGetFinanceSfpDcdOrders) {
                    console.log(`[OKX] Fetching Structured Products (SFP)...`);
                    try {
                        const res = await exchange.privateGetFinanceSfpDcdOrders(); // might need params
                        console.log(`[OKX] SFP Orders Response:`, JSON.stringify(res));
                        if (res.data && Array.isArray(res.data)) {
                            const manualBal = { info: res };
                            let found = false;
                            res.data.forEach(item => {
                                const coin = item.ccy;
                                const amount = parseFloat(item.amt); // Check if 'amt' is correct field
                                if (amount > 0) {
                                    manualBal[coin] = { total: amount };
                                    found = true;
                                }
                            });
                            if (found) processBalance(manualBal, 'OKX Structured Products');
                        }
                    } catch (e) {
                        console.log(`[OKX] SFP Orders failed: ${e.message}`);
                        if (e.message.includes('permission') || e.message.includes('50030')) {
                            sfpPermissionError = true;
                        }
                    }
                }

                // Try Non-Tradable Assets
                if (exchange.privateGetAssetNonTradableAssets) {
                    console.log(`[OKX] Fetching Non-Tradable Assets...`);
                    try {
                        const res = await exchange.privateGetAssetNonTradableAssets();
                        console.log(`[OKX] Non-Tradable Assets Response:`, JSON.stringify(res));
                    } catch (e) {
                        console.log(`[OKX] Non-Tradable Assets failed: ${e.message}`);
                    }
                }

                // Try Account Positions (Sometimes structured products show here)
                if (exchange.privateGetAccountPositions) {
                    console.log(`[OKX] Fetching Account Positions...`);
                    try {
                        const res = await exchange.privateGetAccountPositions();
                        console.log(`[OKX] Account Positions Response:`, JSON.stringify(res));
                    } catch (e) {
                        console.log(`[OKX] Account Positions failed: ${e.message}`);
                    }
                }

                // Try Raw API: Asset Valuation (Total Balance check & Fallback)
                // MOVED TO END to capture all other findings first
                if (exchange.privateGetAssetAssetValuation) {
                    console.log(`[OKX] Fetching Asset Valuation...`);
                    try {
                        const res = await exchange.privateGetAssetAssetValuation({ ccy: 'USDT' });
                        console.log(`[OKX] Asset Valuation Response:`, JSON.stringify(res));

                        if (res.data && res.data[0] && res.data[0].details && res.data[0].details.earn) {
                            const reportedEarnTotal = parseFloat(res.data[0].details.earn);
                            console.log(`[OKX] Reported Earn Total (USDT): ${reportedEarnTotal}`);

                            // Calculate what we have found so far in Earn categories
                            const knownEarnTypes = ['Earn', 'OKX Simple Earn', 'OKX Staking/DeFi', 'OKX Structured Products'];
                            const knownEarnTotal = balances
                                .filter(b => knownEarnTypes.includes(b.type))
                                .reduce((acc, curr) => acc + (curr.value || (curr.amount * curr.price) || 0), 0);

                            console.log(`[OKX] Known Earn Total: ${knownEarnTotal}`);

                            const missingEarn = reportedEarnTotal - knownEarnTotal;
                            if (missingEarn > 1) { // Tolerance of $1
                                // console.log(`[OKX] Found missing Earn assets worth ~${missingEarn} USDT. Adding as aggregated balance.`);

                                // // Check if we hit permission errors earlier
                                // const permissionError = sfpPermissionError ? ' (Check API Permissions)' : ' (Aggregated)';

                                // balances.push({
                                //     coin: 'USDT', // Assume USDT value for aggregation
                                //     amount: missingEarn,
                                //     type: `OKX Earn${permissionError}`,
                                //     rawUsdValue: missingEarn,
                                //     price: 1
                                // });
                            }
                        }
                    } catch (e) {
                        console.log(`[OKX] Asset Valuation failed: ${e.message}`);
                    }
                }

            } catch (e) {
                console.log(`[OKX] Fetch Earn failed: ${e.message}`);
            }
        }

        // Special handling for Bybit Earn (Raw API) - FIXED
        if (platformId.toLowerCase() === 'bybit') {
            // Bybit has multiple earn categories
            // FlexibleSaving: Easy Earn (flexible deposits)
            // FixedSaving: Locked Earn (fixed term deposits)
            // Launchpool: New coin mining
            // DualInvestment: Dual currency investment (options-like products)
            const earnCategories = [
                { name: 'FlexibleSaving', label: 'Bybit Earn (Flexible)' },
                { name: 'FixedSaving', label: 'Bybit Earn (Fixed)' },
                { name: 'Launchpool', label: 'Bybit Launchpool' },
                { name: 'DualInvestment', label: 'Bybit Dual Investment' }
            ];

            for (const { name: category, label } of earnCategories) {
                try {
                    const res = await exchange.privateGetV5EarnPosition({ category });

                    if (res.result && res.result.list && res.result.list.length > 0) {
                        const validItems = res.result.list.filter(item => parseFloat(item.amount || item.size || 0) > 0);

                        if (validItems.length > 0) {
                            console.log(`[${platformId}] Found ${validItems.length} ${category} assets:`, validItems.map(i => i.coin || i.token || i.currency || i.symbol).join(', '));
                            const manualBal = { info: res };
                            validItems.forEach(item => {
                                const coin = item.coin || item.token || item.currency || item.symbol || 'UNKNOWN';
                                const amount = parseFloat(item.amount || item.size || 0);
                                manualBal[coin] = { total: amount };
                            });

                            processBalance(manualBal, label);
                        }
                    }
                } catch (e) {
                    // Only log if it's not a "no data" error
                    if (!e.message.includes('10005')) { // Bybit error code for "no data"
                        console.log(`[${platformId}] Fetch ${category} failed: ${e.message}`);
                    }
                }
            }
        }

        // Fetch Funding
        try { // Added try-catch block for Fetch Funding
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Funding (Standard)...`);
                const fundingBal = await exchange.fetchBalance({ type: 'funding' });
                // const fundingKeys = Object.keys(fundingBal).filter(k => !['info', 'free', 'used', 'total', 'timestamp', 'datetime'].includes(k));
                // console.log(`[${platformId}] Funding Assets Found: ${fundingKeys.join(', ')}`);
                processBalance(fundingBal, 'Funding');
            }
        } catch (e) {
            console.log(`[${platformId}] Fetch Funding failed: ${e.message}`);
        }

        // Fetch Earn/Investment
        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Earn...`);
                const earnBal = await exchange.fetchBalance({ type: 'earn' });
                // console.log(`[${platformId}] Earn keys:`, Object.keys(earnBal).filter(k => !['info', 'free', 'used', 'total'].includes(k)));
                processBalance(earnBal, 'Earn');
            }
        } catch (e) {
            // console.log(`[${platformId}] Fetch Earn failed: ${e.message}`);
        }

        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Investment...`);
                const investBal = await exchange.fetchBalance({ type: 'investment' });
                // console.log(`[${platformId}] Investment keys:`, Object.keys(investBal).filter(k => !['info', 'free', 'used', 'total'].includes(k)));
                processBalance(investBal, 'Investment');
            }
        } catch (e) {
            // console.log(`[${platformId}] Fetch Investment failed:`, e.message);
        }

        // Fetch Dual Asset
        try {
            if (exchange.has['fetchBalance']) {
                console.log(`[${platformId}] Fetching Dual Asset (Standard)...`); // Verbose logging
                const dualBal = await exchange.fetchBalance({ type: 'dual' });
                // Force process even if empty to debug
                processBalance(dualBal, 'Dual Asset');
            }
        } catch (e) {
            console.log(`[${platformId}] Fetch Dual Asset failed:`, e.message); // Changed to console.log
        }

        // Fetch Contract (Derivatives)
        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Contract...`);
                const contractBal = await exchange.fetchBalance({ type: 'contract' });
                // console.log(`[${platformId}] Contract keys:`, Object.keys(contractBal).filter(k => !['info', 'free', 'used', 'total'].includes(k)));
                processBalance(contractBal, 'Contract');
            }
        } catch (e) {
            // console.log(`[${platformId}] Fetch Contract failed:`, e.message);
        }

        // Fetch Option
        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Option...`);
                const optionBal = await exchange.fetchBalance({ type: 'option' });
                // console.log(`[${platformId}] Option keys:`, Object.keys(optionBal).filter(k => !['info', 'free', 'used', 'total'].includes(k)));
                processBalance(optionBal, 'Option');
            }
        } catch (e) {
            // console.log(`[${platformId}] Fetch Option failed:`, e.message);
        }

        // Fetch Margin
        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Margin...`);
                const marginBal = await exchange.fetchBalance({ type: 'margin' });
                processBalance(marginBal, 'Margin');
            }
        } catch (e) {
            // console.log(`[${platformId}] Fetch Margin failed:`, e.message);
        }

        // Fetch Future (USDT-M)
        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Future...`);
                const futureBal = await exchange.fetchBalance({ type: 'future' });
                processBalance(futureBal, 'Futures (USDT-M)');
            } else {
                // console.log(`[${platformId}] 'future' fetch not supported.`);
            }
        } catch (e) {
            console.log(`[${platformId}] Fetch Future failed: ${e.message}`);
        }

        // Fetch Delivery (COIN-M)
        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Delivery...`);
                const deliveryBal = await exchange.fetchBalance({ type: 'delivery' });
                processBalance(deliveryBal, 'Futures (COIN-M)');
            } else {
                // console.log(`[${platformId}] 'delivery' fetch not supported.`);
            }
        } catch (e) {
            console.log(`[${platformId}] Fetch Delivery failed: ${e.message}`);
        }

        // Special handling for Binance Earn (Simple Earn)
        if (platformId.toLowerCase() === 'binance') {
            // Flexible Earn
            try {
                if (exchange.sapiGetSimpleEarnFlexiblePosition) {
                    // console.log(`[${platformId}] Fetching Simple Earn (Flexible)...`);
                    const res = await exchange.sapiGetSimpleEarnFlexiblePosition({ size: 100 }); // limit 100
                    // Response: { rows: [ { asset: 'USDT', totalAmount: '...', ... } ], ... }
                    const rows = res.rows || res;
                    if (Array.isArray(rows)) {
                        const manualBal = { info: res };
                        let found = false;
                        rows.forEach(item => {
                            const coin = item.asset;
                            const amount = parseFloat(item.totalAmount);
                            if (amount > 0) {
                                manualBal[coin] = { total: amount };
                                found = true;
                            }
                        });
                        if (found) {
                            // console.log(`[${platformId}] Found Flexible Earn assets: ${Object.keys(manualBal).filter(k => k !== 'info').join(', ')}`);
                            processBalance(manualBal, 'Binance Earn (Flexible)');
                        }
                    }
                }
            } catch (e) {
                console.log(`[${platformId}] Fetch Earn (Flexible) failed: ${e.message}`);
            }

            // Locked Earn (Fixed)
            try {
                if (exchange.sapiGetSimpleEarnLockedPosition) {
                    // console.log(`[${platformId}] Fetching Simple Earn (Locked)...`);
                    const res = await exchange.sapiGetSimpleEarnLockedPosition({ size: 100 });
                    const rows = res.rows || res;
                    if (Array.isArray(rows)) {
                        const manualBal = { info: res };
                        let found = false;
                        rows.forEach(item => {
                            const coin = item.asset;
                            const amount = parseFloat(item.totalAmount);
                            if (amount > 0) {
                                manualBal[coin] = { total: amount };
                                found = true;
                            }
                        });
                        if (found) processBalance(manualBal, 'Binance Earn (Locked)');
                    }
                }
            } catch (e) {
                console.log(`[${platformId}] Fetch Earn (Locked) failed: ${e.message}`);
            }
        }

        // Special handling for Binance Portfolio Margin (Unified Account)
        if (platformId.toLowerCase() === 'binance') {
            try {
                // Try CCXT type 'unified' first (unlikely but worth a shot)
                // const unifiedBal = await exchange.fetchBalance({ type: 'unified' });
                // processBalance(unifiedBal, 'Unified');

                // Try Raw Portfolio Margin Endpoint
                if (exchange.privateGetPapiV1Balance) {
                    // console.log(`[${platformId}] Fetching Portfolio Margin (Unified)...`);
                    const res = await exchange.privateGetPapiV1Balance();
                    // console.log(`[${platformId}] Portfolio Margin Res:`, JSON.stringify(res));

                    // Response structure is usually array of objects or specific object
                    // Need to parse it. Assuming standard structure or just passing to processBalance if compatible
                    // But usually raw response needs manual parsing.

                    // Example response: [{ asset: 'BTC', totalWalletBalance: '0.1', ... }]
                    if (Array.isArray(res)) {
                        const manualBal = { info: res };
                        res.forEach(item => {
                            const coin = item.asset;
                            const total = parseFloat(item.totalWalletBalance || item.balance || 0);
                            if (total > 0) {
                                manualBal[coin] = { total: total };
                            }
                        });
                        if (Object.keys(manualBal).length > 1) {
                            // console.log(`[${platformId}] Found Portfolio Margin assets.`);
                            processBalance(manualBal, 'Unified Account');
                        }
                    }
                }
            } catch (e) {
                console.log(`[${platformId}] Fetch Portfolio Margin failed: ${e.message}`);
            }

            // Also try privateGetPapiV1AccountBalance
            try {
                if (exchange.privateGetPapiV1AccountBalance) {
                    const res = await exchange.privateGetPapiV1AccountBalance();
                    // Parse similar to above if needed
                }
            } catch (e) { }
        }

        // Fetch Savings/Lending (Some exchanges use these)
        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Savings...`);
                const savingsBal = await exchange.fetchBalance({ type: 'savings' });
                // console.log(`[${platformId}] Savings keys:`, Object.keys(savingsBal).filter(k => !['info', 'free', 'used', 'total'].includes(k)));
                processBalance(savingsBal, 'Savings');
            }
        } catch (e) {
            // console.log(`[${platformId}] Fetch Savings failed:`, e.message);
        }

        // Binance Special: Comprehensive Wallet Scan
        if (platformId.toLowerCase() === 'binance') {
            // 1. User Asset (Wallet Balance) - Covers Spot, Funding, etc.
            try {
                if (exchange.sapiGetAssetWalletBalance) {
                    // console.log(`[${platformId}] Fetching Asset Wallet Balance...`);
                    const res = await exchange.sapiGetAssetWalletBalance();
                    // Response: [{ "activate": true, "balance": "0.00000001", "walletName": "Spot", "currency": "BTC" }, ...]
                    if (Array.isArray(res)) {
                        // Group by walletName
                        const wallets = {};
                        res.forEach(item => {
                            const coin = item.currency;
                            const amount = parseFloat(item.balance);
                            const wallet = item.walletName; // Spot, Funding, Cross Margin, Isolated Margin, etc.

                            if (amount > 0) {
                                if (!wallets[wallet]) wallets[wallet] = { info: res };
                                wallets[wallet][coin] = { total: amount };
                            }
                        });

                        // Process each wallet found
                        Object.keys(wallets).forEach(walletName => {
                            // Skip Spot as we already fetched it (and filtered LD)
                            if (walletName === 'Spot') return;

                            // console.log(`[${platformId}] Processing Wallet Scan: ${walletName} - Assets: ${Object.keys(wallets[walletName]).filter(k => k !== 'info').join(', ')}`);
                            processBalance(wallets[walletName], `Binance Wallet [${walletName}]`);
                        });
                    }
                }
            } catch (e) {
                console.log(`[${platformId}] Fetch Asset Wallet Balance failed: ${e.message}`);
            }

            // 2. Cross Margin Account Details
            try {
                if (exchange.sapiGetMarginAccount) {
                    console.log(`[${platformId}] Fetching Cross Margin Account...`);
                    const res = await exchange.sapiGetMarginAccount();
                    // Response: { userAssets: [ { asset: 'BTC', free: '0.1', locked: '0', borrowed: '0', ... } ] }
                    if (res.userAssets && Array.isArray(res.userAssets)) {
                        const manualBal = { info: res };
                        let found = false;
                        res.userAssets.forEach(item => {
                            const coin = item.asset;
                            const total = parseFloat(item.free) + parseFloat(item.locked);
                            // Note: We might want to subtract borrowed if we want 'Net Equity', but usually user wants to see total assets held
                            // If we want Net, we should do total - borrowed. 
                            // Let's stick to Total Asset for now, or Net? 
                            // User's screenshot shows SOL Value $6592. Price $129.79. Amount 50.79.
                            // 50.79 * 129.79 = 6592.
                            // So it is the Asset amount.

                            if (total > 0) {
                                manualBal[coin] = { total: total };
                                found = true;
                            }
                        });
                        if (found) {
                            console.log(`[${platformId}] Found Cross Margin assets: ${Object.keys(manualBal).filter(k => k !== 'info').join(', ')}`);
                            processBalance(manualBal, 'Binance Cross Margin (Raw)');
                        }
                    }
                }
            } catch (e) {
                console.log(`[${platformId}] Fetch Cross Margin failed: ${e.message}`);
            }
        }

        // 2. Fetch Prices (Only for those missing rawUsdValue)
        // Map coin symbols to CoinGecko IDs
        const symbolToCoinGeckoId = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'BNB': 'binancecoin',
            'ADA': 'cardano',
            'OKB': 'okb',
            'TON': 'the-open-network',
            'SUI': 'sui',
            'MNT': 'mantle',
            'BBSOL': 'bybit-staked-sol',
            // Add more as needed
        };

        // Normalize coins for price lookup (e.g. handle Binance LD prefix)
        const getPriceSymbol = (coin) => {
            if (platformId.toLowerCase() === 'binance' && coin.startsWith('LD') && coin.length > 3) {
                return coin.substring(2);
            }
            return coin;
        };

        const symbolsToFetch = new Set();
        const coinToPriceSymbol = {}; // Map original coin to price symbol

        balances.forEach(b => {
            if (!b.rawUsdValue && b.coin !== 'USDT' && b.coin !== 'USDC') {
                const priceCoin = getPriceSymbol(b.coin);
                const symbol = `${priceCoin}/USDT`;
                symbolsToFetch.add(symbol);
                coinToPriceSymbol[b.coin] = symbol;
            }
        });

        let tickers = {};
        if (exchange.has['fetchTickers'] && symbolsToFetch.size > 0) {
            // console.log(`[${platformId}] Fetching prices for: ${Array.from(symbolsToFetch).join(', ')}`);
            try {
                // Try fetching specific tickers first
                tickers = await exchange.fetchTickers(Array.from(symbolsToFetch));
                console.log(`[${platformId}] Fetched ${Object.keys(tickers).length} tickers.`);
            } catch (e) {
                console.log(`[${platformId}] Specific ticker fetch failed (${e.message}), fetching ALL tickers...`);
                try {
                    tickers = await exchange.fetchTickers();
                    console.log(`[${platformId}] Fetched ALL tickers (${Object.keys(tickers).length}).`);
                } catch (e2) {
                    console.log(`[${platformId}] Fetch ALL tickers failed: ${e2.message}`);
                }
            }
        }

        // Fetch prices from CoinGecko for symbols that couldn't be priced via exchange tickers
        const coinsForCoinGecko = balances
            .filter(b => !b.rawUsdValue && b.coin !== 'USDT' && b.coin !== 'USDC')
            .map(b => getPriceSymbol(b.coin))
            .filter(coin => {
                const symbol = `${coin}/USDT`;
                return !tickers[symbol]; // Only coins without ticker price
            });

        let coinGeckoPrices = {};
        if (coinsForCoinGecko.length > 0) {
            try {
                const coinGeckoIds = coinsForCoinGecko.map(coin => symbolToCoinGeckoId[coin] || coin.toLowerCase()).join(',');
                console.log(`[${platformId}] Fetching CoinGecko prices for: ${coinsForCoinGecko.join(', ')}`);

                const cgResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds}&vs_currencies=usd`);
                const cgData = await cgResponse.json();

                // Map back to symbols
                coinsForCoinGecko.forEach(coin => {
                    const cgId = symbolToCoinGeckoId[coin] || coin.toLowerCase();
                    if (cgData[cgId] && cgData[cgId].usd) {
                        coinGeckoPrices[coin] = cgData[cgId].usd;
                    }
                });

                console.log(`[${platformId}] Got ${Object.keys(coinGeckoPrices).length} prices from CoinGecko`);
            } catch (e) {
                console.log(`[${platformId}] CoinGecko fetch failed: ${e.message}`);
            }
        }

        // 3. Finalize
        const finalBalances = balances.map(b => {
            let price = b.price;
            let value = b.rawUsdValue;

            // If we have a raw value, trust it (it implies price)
            if (value > 0) {
                price = value / b.amount;
            } else {
                // Fallback to ticker price
                if (b.coin === 'USDT' || b.coin === 'USDC') {
                    price = 1;
                } else {
                    const priceCoin = getPriceSymbol(b.coin);
                    const symbol = coinToPriceSymbol[b.coin] || `${priceCoin}/USDT`;

                    if (tickers[symbol]) {
                        price = tickers[symbol].last;
                    } else if (coinGeckoPrices[priceCoin]) {
                        // Use CoinGecko price as fallback
                        price = coinGeckoPrices[priceCoin];
                    }
                }
                value = b.amount * price;
            }

            return {
                symbol: b.coin,
                amount: b.amount,
                type: b.type,
                price: price,
                value: value
            };
        });

        res.json({
            platform: platformId,
            balances: finalBalances
        });

    } catch (error) {
        console.error(`CEX Error (${platformId}):`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- CEX Earn Products Endpoint ---
app.post('/api/cex/earn-products', async (req, res) => {
    const { platformId, apiKey, apiSecret, password } = req.body;

    if (!platformId) {
        return res.status(400).json({ error: 'Missing platformId' });
    }

    console.log(`[API] Fetching earn products for ${platformId}`);

    try {
        const products = [];

        // OKX - Public API (no auth needed)
        if (platformId.toLowerCase() === 'okx') {
            const exchange = new ccxt.okx({ enableRateLimit: true });

            if (exchange.publicGetFinanceSavingsLendingRateSummary) {
                const res = await exchange.publicGetFinanceSavingsLendingRateSummary();

                if (res.data && Array.isArray(res.data)) {
                    res.data.forEach(item => {
                        // OKX estRate is already the ANNUAL percentage rate (APR)
                        // e.g., "3.65" means 3.65% APR
                        const apr = parseFloat(item.estRate || item.rate || 0);

                        products.push({
                            asset: item.ccy,
                            type: 'flexible',
                            apr: apr,
                            dailyRate: apr / 365 / 100, // Convert APR to daily decimal rate
                            canPurchase: true, // OKX doesn't provide this field
                            minAmount: null,
                            maxAmount: null
                        });
                    });
                }
            }
        }

        // Binance - Requires API Key
        if (platformId.toLowerCase() === 'binance') {
            if (!apiKey || !apiSecret) {
                return res.status(400).json({ error: 'Binance requires apiKey and apiSecret' });
            }

            const exchange = new ccxt.binance({
                apiKey,
                secret: apiSecret,
                enableRateLimit: true
            });

            if (exchange.sapiGetSimpleEarnFlexibleList) {
                const response = await exchange.sapiGetSimpleEarnFlexibleList({ size: 100 });
                const rows = response.rows || response;

                if (Array.isArray(rows)) {
                    rows.forEach(item => {
                        const apr = parseFloat(item.latestAnnualPercentageRate || item.latestApr || 0);

                        products.push({
                            asset: item.asset,
                            type: 'flexible',
                            apr: apr,
                            dailyRate: apr / 365 / 100,
                            canPurchase: item.canPurchase || item.purchaseAvailable || false,
                            minAmount: parseFloat(item.minPurchaseAmount || 0),
                            maxAmount: parseFloat(item.maxPurchaseAmount || item.purchaseAmountLimit || 0) || null
                        });
                    });
                }
            }
        }

        // Bybit - Public API (V5)
        if (platformId.toLowerCase() === 'bybit') {
            const exchange = new ccxt.bybit({ enableRateLimit: true });

            // Try V5 Public Endpoint
            if (exchange.publicGetV5EarnProduct) {
                // Fetch Flexible Saving
                const res = await exchange.publicGetV5EarnProduct({ category: 'FlexibleSaving' });

                if (res.result && res.result.list && Array.isArray(res.result.list)) {
                    res.result.list.forEach(item => {
                        // APR is usually in tierAprDetails or estimateApr
                        // Format might be "5.92%" string
                        let apr = 0;

                        // Try to find the best APR to show (usually the first tier or base estimate)
                        if (item.estimateApr) {
                            apr = parseFloat(item.estimateApr.replace('%', ''));
                        } else if (item.tierAprDetails && item.tierAprDetails.length > 0) {
                            apr = parseFloat(item.tierAprDetails[0].estimateApr.replace('%', ''));
                        }

                        products.push({
                            asset: item.coin,
                            type: 'flexible',
                            apr: apr, // Bybit returns annual percentage (e.g. 5.92)
                            dailyRate: apr / 365 / 100,
                            canPurchase: item.status === 'Available',
                            minAmount: parseFloat(item.minStakeAmount || 0),
                            maxAmount: parseFloat(item.maxStakeAmount || 0) || null
                        });
                    });
                }
            }
        }

        // Sort by APR descending
        products.sort((a, b) => b.apr - a.apr);

        res.json({
            platform: platformId,
            products: products
        });

    } catch (error) {
        console.error(`Earn Products Error (${platformId}):`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- On-Chain Endpoints ---

// EVM Provider (using public RPCs)
const EVM_RPCS = {
    ethereum: 'https://cloudflare-eth.com',
    bsc: 'https://bsc-dataseed.binance.org',
    polygon: 'https://polygon-rpc.com',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    optimism: 'https://mainnet.optimism.io',
    base: 'https://mainnet.base.org',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
};

// Solana Provider
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

// --- Token Definitions ---

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

// Popular Tokens (Add more as needed)
const TOKENS = {
    ethereum: [
        { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
        { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
        { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
        { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
        { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
        { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
        { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18 },
        { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18 }
    ],
    bsc: [
        { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
        { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
        { symbol: 'DAI', address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18 },
        { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18 }
    ],
    polygon: [
        { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
        { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
        { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
        { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 }
    ],
    arbitrum: [
        { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
        { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
        { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18 }
    ],
    optimism: [
        { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499a98a359659956', decimals: 6 },
        { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf9928370378d61', decimals: 6 },
        { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18 }
    ],
    base: [
        { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
        { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6 }
    ],
    avalanche: [
        { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
        { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6 }
    ]
};

// Solana Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// --- Price Oracle (Binance) ---
const priceOracle = new ccxt.binance();

app.post('/api/chain/balance', async (req, res) => {
    const { chainType, address, chains } = req.body; // chainType: 'evm', 'solana', 'bitcoin', 'sui'

    if (!chainType || !address) {
        return res.status(400).json({ error: 'Missing chainType or address' });
    }

    console.log(`[Chain] Fetching ${chainType} balance for ${address}`);

    try {
        let balances = [];

        // --- EVM Multi-Chain Handler ---
        if (chainType === 'evm' || EVM_RPCS[chainType]) {
            const chainsToScan = (chainType === 'evm') ? (chains || Object.keys(EVM_RPCS)) : [chainType];
            console.log(`[EVM] Scanning chains: ${chainsToScan.join(', ')}`);

            await Promise.all(chainsToScan.map(async (chain) => {
                if (!EVM_RPCS[chain]) return;

                try {
                    console.log(`[EVM] Connecting to ${chain}...`);
                    const provider = new ethers.JsonRpcProvider(EVM_RPCS[chain]);

                    // 1. Native Coin
                    const balanceWei = await provider.getBalance(address);
                    const balanceEth = parseFloat(ethers.formatEther(balanceWei));
                    console.log(`[${chain}] Native Balance: ${balanceEth}`);

                    let nativeSymbol = 'ETH';
                    if (chain === 'bsc') nativeSymbol = 'BNB';
                    if (chain === 'polygon') nativeSymbol = 'MATIC';
                    if (chain === 'avalanche') nativeSymbol = 'AVAX';

                    if (balanceEth > 0) {
                        balances.push({ chain, symbol: nativeSymbol, amount: balanceEth, type: 'Native' });
                    }

                    // 2. ERC20 Tokens (Only if defined in TOKENS)
                    if (TOKENS[chain]) {
                        await Promise.all(TOKENS[chain].map(async (token) => {
                            try {
                                const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
                                const balance = await contract.balanceOf(address);
                                const formatted = parseFloat(ethers.formatUnits(balance, token.decimals));

                                if (formatted > 0) {
                                    balances.push({ chain, symbol: token.symbol, amount: formatted, type: 'ERC20', address: token.address });
                                }
                            } catch (e) {
                                // console.error(`Failed to fetch ${token.symbol} on ${chain}:`, e.message);
                            }
                        }));
                    }

                    // 3. DeFi Balances (Aave V3) - DISABLED for stability
                    // try {
                    //     const aaveBalances = await fetchAaveV3Balances(provider, address, chain);
                    //     balances.push(...aaveBalances);
                    // } catch (err) {
                    //     console.error(`[DeFi] Failed to fetch Aave V3 for ${chain}:`, err.message);
                    // }

                } catch (e) {
                    console.error(`[EVM] Failed to scan ${chain}:`, e.message);
                }
            }));
        }
        // --- Solana Handler ---
        else if (chainType === 'solana') {
            const connection = new Connection(SOLANA_RPC);
            const publicKey = new PublicKey(address);

            // 1. Native SOL
            const balanceLamports = await connection.getBalance(publicKey);
            const balanceSol = balanceLamports / 1e9;

            if (balanceSol > 0) {
                balances.push({ chain: 'solana', symbol: 'SOL', amount: balanceSol, type: 'Native' });
            }

            // 2. SPL Tokens
            try {
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    programId: TOKEN_PROGRAM_ID
                });

                tokenAccounts.value.forEach((accountInfo) => {
                    const parsedInfo = accountInfo.account.data.parsed.info;
                    const amount = parseFloat(parsedInfo.tokenAmount.uiAmount);
                    const mint = parsedInfo.mint;

                    if (amount > 0) {
                        // Map known mints to symbols (Simplified)
                        let symbol = mint.substring(0, 4) + '...';
                        if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') symbol = 'USDC';
                        if (mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') symbol = 'USDT';
                        if (mint === '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R') symbol = 'RAY';
                        if (mint === 'JUPyiwrYJFskUPiHa7hkeR8VUtkTrVMk1L2J8bKWNS9') symbol = 'JUP';
                        if (mint === 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263') symbol = 'BONK';

                        balances.push({ chain: 'solana', symbol, amount, type: 'SPL', address: mint });
                    }
                });
            } catch (e) {
                console.error('SPL Token fetch failed:', e.message);
            }
        }
        // --- Bitcoin Handler ---
        else if (chainType === 'bitcoin') {
            try {
                console.log(`[Bitcoin] Fetching balance for ${address}...`);
                const response = await fetch(`https://mempool.space/api/address/${address}`);

                if (!response.ok) {
                    throw new Error(`mempool.space API returned ${response.status}`);
                }

                const data = await response.json();

                // Calculate confirmed balance (in satoshis)
                const confirmedBalance = (data.chain_stats?.funded_txo_sum || 0) - (data.chain_stats?.spent_txo_sum || 0);

                // Calculate unconfirmed balance (in satoshis)
                const unconfirmedBalance = (data.mempool_stats?.funded_txo_sum || 0) - (data.mempool_stats?.spent_txo_sum || 0);

                // Total balance in BTC (convert from satoshis)
                const totalBtc = (confirmedBalance + unconfirmedBalance) / 100000000;

                console.log(`[Bitcoin] Balance: ${totalBtc} BTC (Confirmed: ${confirmedBalance / 100000000}, Unconfirmed: ${unconfirmedBalance / 100000000})`);

                if (totalBtc > 0) {
                    balances.push({
                        chain: 'bitcoin',
                        symbol: 'BTC',
                        amount: totalBtc,
                        type: 'Native'
                    });
                }
            } catch (e) {
                console.error(`[Bitcoin] Failed to fetch balance: ${e.message}`);
            }
        }
        // --- Sui Handler (Placeholder) ---
        else if (chainType === 'sui') {
            // Implement Sui RPC fetch here
            console.log('Sui fetch not implemented yet');
        }

        // --- Price Fetching ---
        if (balances.length > 0) {
            console.log(`[Chain] Found ${balances.length} assets. Fetching prices...`);
            try {
                // Extract symbols to fetch and DEDUPLICATE
                const symbolsToFetch = [...new Set(balances
                    .filter(b => {
                        // Skip stables
                        if (['USDT', 'USDC', 'DAI'].includes(b.symbol)) return false;
                        // Skip truncated SPL tokens (e.g. "Afh1...") or unknown symbols
                        if (b.symbol.endsWith('...') || b.symbol.length > 10) return false;
                        return true;
                    })
                    .map(b => {
                        let sym = b.symbol;
                        if (sym === 'WETH') sym = 'ETH';
                        if (sym === 'WBTC') sym = 'BTC';
                        if (sym === 'MATIC') sym = 'POL'; // Polygon ticker change
                        return `${sym}/USDT`;
                    }))];

                // Fetch tickers
                let tickers = {};
                if (symbolsToFetch.length > 0) {
                    try {
                        tickers = await priceOracle.fetchTickers(symbolsToFetch);
                    } catch (e) {
                        console.error(`[Price] Fetch tickers failed: ${e.message}`);
                    }
                }

                // Attach prices
                balances.forEach(b => {
                    // Default values to avoid NaN
                    b.price = 0;
                    b.value = 0;

                    if (['USDT', 'USDC', 'DAI'].includes(b.symbol)) {
                        b.price = 1.0;
                        b.value = b.amount;
                        return;
                    }

                    let sym = b.symbol;
                    if (sym === 'WETH') sym = 'ETH';
                    if (sym === 'WBTC') sym = 'BTC';
                    if (sym === 'MATIC') sym = 'POL';
                    const tickerSymbol = `${sym}/USDT`;

                    if (tickers[tickerSymbol]) {
                        b.price = tickers[tickerSymbol].last;
                        b.value = b.amount * b.price;
                    } else {
                        // console.log(`[Price] No ticker for ${b.symbol}`);
                    }
                });
            } catch (error) {
                console.error('Price fetch error:', error.message);
            }
        }

        res.json({
            chainType,
            address,
            balances,
            totalValue: balances.reduce((sum, b) => sum + (b.value || 0), 0)
        });

    } catch (error) {
        console.error('Chain fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
