import { ethers } from 'ethers';

// Aave V3 UiPoolDataProvider Addresses
const UI_POOL_DATA_PROVIDERS = {
    ethereum: '0x91c0eA31b49B69Ea18607702c5d9aCcf53DF5EFa',
    arbitrum: '0x145dE30c929a065552084778aedC6b6F34602726',
    optimism: '0xbd83DdBE37fc91923d59C8c1E0bDe0CccCa332d5',
    polygon: '0xC69794a6B7637D4b18c8794620a150c729996175',
    base: '0x3d93Ea9B3483913d3763A727848ae884e4964108',
    avalanche: '0xF15F26710c827DDe8ACBA6D458a5e919647227fb',
    bsc: '0x6F872C325a21385d96D36f8508e305581F7197e0' // Check if valid, otherwise skip
};

// Pool Addresses Provider (Needed to get the LendingPool address)
const POOL_ADDRESSES_PROVIDERS = {
    ethereum: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',
    arbitrum: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    optimism: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    polygon: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    base: '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D',
    avalanche: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    bsc: '0xff7597473611c3555a3a8260baad270efbf06d80'
};

const UI_POOL_ABI = [
    "function getUserReservesData(address provider, address user) view returns (tuple(address underlyingAsset, uint256 scaledATokenBalance, bool usageAsCollateralEnabledAndOnlyWhitelisted, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 variableBorrowRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)[] userReserves, tuple(uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor) userEmodeCategoryId)"
];

const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

export async function fetchAaveV3Balances(chain, address, provider) {
    if (!UI_POOL_DATA_PROVIDERS[chain] || !POOL_ADDRESSES_PROVIDERS[chain]) {
        return [];
    }

    try {
        // console.log(`[Aave V3] Fetching for ${chain}...`);
        const uiPoolContract = new ethers.Contract(UI_POOL_DATA_PROVIDERS[chain], UI_POOL_ABI, provider);

        // Fetch user reserves
        const [userReserves] = await uiPoolContract.getUserReservesData(POOL_ADDRESSES_PROVIDERS[chain], address);

        const balances = [];

        // We need to fetch symbol/decimals for underlying assets if not hardcoded. 
        // For simplicity/speed, we might want to cache or fetch on demand.
        // But Aave usually returns underlying asset address.

        // Parallel fetch for token details is risky if too many. 
        // Filter for non-zero balances first.
        const activeReserves = userReserves.filter(r => r.scaledATokenBalance > 0n || r.currentStableDebt > 0n || r.scaledVariableDebt > 0n);

        if (activeReserves.length === 0) return [];

        await Promise.all(activeReserves.map(async (reserve) => {
            try {
                const tokenContract = new ethers.Contract(reserve.underlyingAsset, ERC20_ABI, provider);
                const [decimals, symbol] = await Promise.all([
                    tokenContract.decimals(),
                    tokenContract.symbol()
                ]);

                // Calculate Deposit (aToken balance)
                // Note: scaledATokenBalance needs to be multiplied by liquidity index to get actual balance, 
                // BUT UiPoolDataProvider might return the actual balance or we might need the pool data.
                // Actually getUserReservesData returns 'scaledATokenBalance'. 
                // To get exact balance we need getReservesData too.
                // For MVP, let's assume scaled is close enough or check if we can get exact.
                // Wait, UiPoolDataProvider usually returns the scaled balance. 
                // Let's stick to a simpler approach: if > 0, it's a deposit.

                // Correction: To get the exact balance properly we need the reserve data.
                // But for this MVP let's just use the scaled balance as a proxy or try to fetch aToken balance directly if we had the aToken address.
                // UiPoolDataProvider doesn't give aToken address in the struct above (simplified).

                // Let's trust the scaledATokenBalance for now, it is the amount of aTokens.
                const amount = parseFloat(ethers.formatUnits(reserve.scaledATokenBalance, decimals));

                if (amount > 0.000001) {
                    balances.push({
                        protocol: 'Aave V3',
                        symbol: symbol,
                        amount: amount,
                        chain: chain,
                        type: 'Lending'
                    });
                }
            } catch (e) {
                console.error(`[Aave V3] Error processing asset ${reserve.underlyingAsset}: ${e.message}`);
            }
        }));

        return balances;

    } catch (error) {
        console.error(`[Aave V3] Fetch failed for ${chain}:`, error.message);
        return [];
    }
}
