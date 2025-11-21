import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { PriceMonitor } from './pages/PriceMonitor';
import { CexAssets } from './pages/CexAssets';
import { OnChainWallets } from './pages/OnChainWallets';
import { FiatLedger } from './pages/FiatLedger';
import { Transactions } from './pages/Transactions';

function App() {
    const [activeTab, setActiveTab] = useState('monitor');

    const renderContent = () => {
        switch (activeTab) {
            case 'monitor':
                return <PriceMonitor />;
            case 'cex':
                return <CexAssets />;
            case 'onchain':
                return <OnChainWallets />;
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
