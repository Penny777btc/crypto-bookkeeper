import React, { useState } from 'react';
import { LayoutDashboard, LineChart, Wallet, Banknote, History, Settings, Menu } from 'lucide-react';
import { cn } from '../utils/utils';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const menuItems = [
        { id: 'monitor', label: 'Price Monitor', icon: LineChart },
        { id: 'cex', label: 'CEX Assets', icon: LayoutDashboard },
        { id: 'onchain', label: 'On-chain Wallets', icon: Wallet },
        { id: 'fiat', label: 'Fiat/USDT Ledger', icon: Banknote },
        { id: 'transactions', label: 'Transactions', icon: History },
    ];

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-card border-r border-border transition-all duration-300 flex flex-col",
                    sidebarOpen ? "w-64" : "w-16"
                )}
            >
                <div className="p-4 flex items-center justify-between border-b border-border">
                    {sidebarOpen && (
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-md" />
                            <h1 className="font-bold text-xl truncate">CryptoBook</h1>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-accent rounded-md"
                    >
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                                activeTab === item.id
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <item.icon size={20} />
                            {sidebarOpen && <span>{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-border">
                    {sidebarOpen && <div className="text-xs text-muted-foreground">v1.0.0 Local</div>}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-secondary/20">
                <div className="p-6 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};
