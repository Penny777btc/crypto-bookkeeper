import express from 'express';
import cors from 'cors';
import ccxt from 'ccxt';
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- CEX Endpoints ---

app.post('/api/cex/balance', async (req, res) => {
    const { platformId, apiKey, apiSecret } = req.body;

    if (!platformId || !apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    try {
        if (!ccxt[platformId]) {
            return res.status(400).json({ error: `Exchange ${platformId} not supported by ccxt` });
        }

        const exchange = new ccxt[platformId]({
            apiKey: apiKey,
            secret: apiSecret,
            enableRateLimit: true,
        });

        const balances = []; // This will store all processed balance items
        const seenEquities = new Set(); // To detect duplicate account views

        // Helper to process balance
        const processBalance = (bal, type) => {
            // Try to find total equity/value from the exchange response
            let exchangeReportedTotal = 0;
            if (bal.info?.result?.list?.[0]?.totalEquity) {
                exchangeReportedTotal = parseFloat(bal.info.result.list[0].totalEquity);
            }

            // DUPLICATE DETECTION:
            // Strategy: Content-based deduplication (Signature check)
            // We create a signature based on the sorted list of "coin:amount".
            // If two endpoints return the exact same assets and amounts, we treat them as duplicates.
            // We DO NOT rely on 'totalEquity' for deduplication anymore, because some exchanges (like Bybit Unified)
            // might report the same Global Equity across different endpoints (Spot, Earn) even if the asset lists are different.

            const assets = [];
            Object.keys(bal).forEach(key => {
                if (key !== 'info' && key !== 'free' && key !== 'used' && key !== 'total') {
                    const total = bal[key].total;
                    if (total > 0) {
                        // Round to 6 decimals to avoid floating point differences causing false negatives
                        // e.g. 20.49820001 vs 20.49820002
                        assets.push(`${key}:${parseFloat(total.toFixed(6))}`);
                    }
                }
            });
            const signature = assets.sort().join('|');

            // If signature is empty, it's an empty account. We can track it to avoid processing multiple empty views if desired,
            // but usually harmless to keep.
            // If signature is empty, it's an empty account. We can track it to avoid processing multiple empty views if desired,
            // but usually harmless to keep.
            // If signature is empty, it's an empty account. We can track it to avoid processing multiple empty views if desired,
            // but usually harmless to keep.
            // If signature is seen, it's a duplicate view.
            if (signature && seenEquities.has(signature)) {
                console.log(`[${platformId}] Skipping duplicate account view for ${type} (Signature match)`);
                return;
            }
            if (signature) seenEquities.add(signature);

            console.log(`[${platformId}] Processing ${type}. Reported Total: ${exchangeReportedTotal}`);

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
                if (key !== 'info' && key !== 'free' && key !== 'used' && key !== 'total') {
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
            processBalance(balance, 'Spot/Unified');
        } catch (e) {
            console.error('Fetch balance failed:', e.message);
        }

        // Special handling for Bybit Earn (Raw API) - FIXED
        if (platformId.toLowerCase() === 'bybit') {
            // Fetch Flexible Saving (Easy Earn)
            try {
                // console.log(`[${platformId}] Fetching Earn (FlexibleSaving)...`);
                const res = await exchange.privateGetV5EarnPosition({ category: 'FlexibleSaving' });

                if (res.result && res.result.list && res.result.list.length > 0) {
                    const validItems = res.result.list.filter(item => parseFloat(item.amount || item.size || 0) > 0);

                    if (validItems.length > 0) {
                        console.log(`[${platformId}] Found ${validItems.length} Earn assets.`);
                        const manualBal = { info: res };
                        validItems.forEach(item => {
                            const coin = item.coin || item.token || item.currency || item.symbol || 'UNKNOWN';
                            const amount = parseFloat(item.amount || item.size || 0);
                            manualBal[coin] = { total: amount };
                        });
                        processBalance(manualBal, 'Bybit Earn');
                    }
                }
            } catch (e) {
                console.log(`[${platformId}] Fetch Earn failed: ${e.message}`);
            }
        }

        // Fetch Funding
        try {
            if (exchange.has['fetchBalance']) {
                // console.log(`[${platformId}] Fetching Funding...`);
                const fundingBal = await exchange.fetchBalance({ type: 'funding' });
                // console.log(`[${platformId}] Funding keys:`, Object.keys(fundingBal).filter(k => !['info', 'free', 'used', 'total'].includes(k)));
                processBalance(fundingBal, 'Funding');
            }
        } catch (e) {
            // console.log(`[${platformId}] Fetch Funding failed:`, e.message);
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
            // console.log(`[${platformId}] Fetch Earn failed:`, e.message);
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
                // console.log(`[${platformId}] Fetching Dual Asset...`);
                const dualBal = await exchange.fetchBalance({ type: 'dual' });
                // console.log(`[${platformId}] Dual Asset keys:`, Object.keys(dualBal).filter(k => !['info', 'free', 'used', 'total'].includes(k)));
                processBalance(dualBal, 'Dual Asset');
            }
        } catch (e) {
            // console.log(`[${platformId}] Fetch Dual Asset failed:`, e.message);
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

        // Fetch Funding (Binance specific or generic)
        try {
            if (exchange.has['fetchBalance']) {
                console.log(`[${platformId}] Fetching Funding...`);
                const fundingBal = await exchange.fetchBalance({ type: 'funding' });
                processBalance(fundingBal, 'Funding');
            } else {
                console.log(`[${platformId}] 'funding' fetch not supported.`);
            }
        } catch (e) {
            console.log(`[${platformId}] Fetch Funding failed:`, e.message);
        }

        // Fetch Future (USDT-M)
        try {
            if (exchange.has['fetchBalance']) {
                console.log(`[${platformId}] Fetching Future...`);
                const futureBal = await exchange.fetchBalance({ type: 'future' });
                processBalance(futureBal, 'Futures (USDT-M)');
            } else {
                console.log(`[${platformId}] 'future' fetch not supported.`);
            }
        } catch (e) {
            console.log(`[${platformId}] Fetch Future failed:`, e.message);
        }

        // Fetch Delivery (COIN-M)
        try {
            if (exchange.has['fetchBalance']) {
                console.log(`[${platformId}] Fetching Delivery...`);
                const deliveryBal = await exchange.fetchBalance({ type: 'delivery' });
                processBalance(deliveryBal, 'Futures (COIN-M)');
            } else {
                console.log(`[${platformId}] 'delivery' fetch not supported.`);
            }
        } catch (e) {
            console.log(`[${platformId}] Fetch Delivery failed:`, e.message);
        }

        // Special handling for Binance Earn (Simple Earn)
        if (platformId.toLowerCase() === 'binance') {
            // Flexible Earn
            try {
                if (exchange.sapiGetSimpleEarnFlexiblePosition) {
                    console.log(`[${platformId}] Fetching Simple Earn (Flexible)...`);
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
                        if (found) processBalance(manualBal, 'Binance Earn (Flexible)');
                    }
                }
            } catch (e) {
                console.log(`[${platformId}] Fetch Earn (Flexible) failed: ${e.message}`);
            }

            // Locked Earn (Fixed)
            try {
                if (exchange.sapiGetSimpleEarnLockedPosition) {
                    console.log(`[${platformId}] Fetching Simple Earn (Locked)...`);
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
                    console.log(`[${platformId}] Fetching Portfolio Margin (Unified)...`);
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
                            console.log(`[${platformId}] Found Portfolio Margin assets.`);
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
                    console.log(`[${platformId}] Fetching Asset Wallet Balance...`);
                    const res = await exchange.sapiGetAssetWalletBalance();
                    // Response: [{ "activate": true, "balance": "0.00000001", "walletName": "Spot", "currency": "BTC" }, ...]
                    if (Array.isArray(res)) {
                        const manualBal = { info: res };
                        let found = false;
                        res.forEach(item => {
                            const coin = item.currency;
                            const amount = parseFloat(item.balance);
                            const wallet = item.walletName; // Spot, Funding, Cross Margin, Isolated Margin, etc.
                            if (amount > 0) {
                                // We can group by wallet or just dump them all
                                // Let's try to group by wallet to avoid duplicates with existing fetches
                                // But since we have deduplication, we can just process them with specific names
                                // processBalance(manualBal, `Binance Wallet [${wallet}]`); // This would be too many calls
                            }
                        });

                        // Let's specifically look for "Unified" or "Margin" if we missed them
                        const unifiedItems = res.filter(i => i.walletName === 'Unified' || i.walletName === 'Cross Margin');
                        if (unifiedItems.length > 0) {
                            const unifiedBal = { info: res };
                            unifiedItems.forEach(item => {
                                if (parseFloat(item.balance) > 0) {
                                    unifiedBal[item.currency] = { total: parseFloat(item.balance) };
                                }
                            });
                            processBalance(unifiedBal, 'Binance Unified/Margin (Wallet Scan)');
                        }
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
                            if (total > 0) {
                                manualBal[coin] = { total: total };
                                found = true;
                            }
                        });
                        if (found) processBalance(manualBal, 'Binance Cross Margin (Raw)');
                    }
                }
            } catch (e) {
                console.log(`[${platformId}] Fetch Cross Margin failed: ${e.message}`);
            }
        }

        // 2. Fetch Prices (Only for those missing rawUsdValue)
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
                    const symbol = coinToPriceSymbol[b.coin] || `${b.coin}/USDT`;
                    if (tickers[symbol]) {
                        price = tickers[symbol].last;
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

// --- On-Chain Endpoints ---

// EVM Provider (using public RPCs - can be slow/rate-limited)
const EVM_RPCS = {
    ethereum: 'https://eth.llamarpc.com',
    bsc: 'https://binance.llamarpc.com',
    polygon: 'https://polygon.llamarpc.com',
    arbitrum: 'https://arbitrum.llamarpc.com',
    optimism: 'https://optimism.llamarpc.com',
};

// Solana Provider
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

app.post('/api/chain/balance', async (req, res) => {
    const { chain, address } = req.body;

    if (!chain || !address) {
        return res.status(400).json({ error: 'Missing chain or address' });
    }

    try {
        const balances = [];

        if (chain === 'solana') {
            const connection = new Connection(SOLANA_RPC);
            const publicKey = new PublicKey(address);
            const balanceLamports = await connection.getBalance(publicKey);
            const balanceSol = balanceLamports / 1e9;

            if (balanceSol > 0) {
                balances.push({ symbol: 'SOL', amount: balanceSol });
            }
            // Note: Fetching SPL tokens requires more complex logic (getParsedTokenAccountsByOwner)
            // We will stick to native SOL for this simple version.

        } else if (EVM_RPCS[chain]) {
            const provider = new ethers.JsonRpcProvider(EVM_RPCS[chain]);
            const balanceWei = await provider.getBalance(address);
            const balanceEth = parseFloat(ethers.formatEther(balanceWei));

            if (balanceEth > 0) {
                const symbol = chain === 'bsc' ? 'BNB' : (chain === 'polygon' ? 'MATIC' : 'ETH');
                balances.push({ symbol, amount: balanceEth });
            }
            // Note: ERC20 tokens require iterating over a token list and calling contract.balanceOf()
            // This is too heavy for a simple endpoint without an indexer API (like Covalent/Moralis).
            // We stick to native coin for now.
        } else {
            return res.status(400).json({ error: 'Unsupported chain' });
        }

        res.json({ chain, address, balances });

    } catch (error) {
        console.error(`Chain Error (${chain}):`, error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Local proxy server running at http://localhost:${PORT}`);
});
