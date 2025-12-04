import { useState } from 'react';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PriceMonitor } from './pages/PriceMonitor';
import { CexAssets } from './pages/CexAssets';
import { OnChainWallets } from './pages/OnChainWallets';
import { FiatLedger } from './pages/FiatLedger';
import { Transactions } from './pages/Transactions';

import { useStore } from './store/useStore';

function App() {
    const { activeTab, setActiveTab } = useStore();

    const renderContent = () => {
        switch (activeTab) {
            case 'monitor':
                return <PriceMonitor />;
            case 'cex':
                return <CexAssets />;
            case 'onchain':
                return (
                    <ErrorBoundary fallback={<div className="p-8 text-center text-red-500">Something went wrong in On-Chain Wallets. Please refresh the page.</div>}>
                        <OnChainWallets />
                    </ErrorBoundary>
                );
            case 'fiat':
                return <FiatLedger />;
            case 'transactions':
                return <Transactions />;
            default:
                return <PriceMonitor />;
        }
    };

    return (
        <Layout activeTab={activeTab} onTabChange={setActiveTab}>
            {renderContent()}
        </Layout>
    );
}

export default App;
