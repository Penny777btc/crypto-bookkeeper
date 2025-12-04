import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent } from '../ui';
import { formatCurrency } from '../../utils/utils';
import { Transaction } from '../../types';

interface PnLCalendarProps {
    transactions: Transaction[];
}

export const PnLCalendar: React.FC<PnLCalendarProps> = ({ transactions }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);

    const dailyPnL = useMemo(() => {
        const result: Record<string, number> = {};
        const hasSell: Set<string> = new Set();

        transactions.forEach(tx => {
            if (tx.type === 'Sell') {
                const dateKey = format(new Date(tx.date), 'yyyy-MM-dd');
                hasSell.add(dateKey);
                if (tx.pnl != null && !isNaN(tx.pnl)) {
                    result[dateKey] = (result[dateKey] || 0) + tx.pnl;
                }
            }
        });

        // For days with sells but no PnL (sell-only transactions), mark as 0
        hasSell.forEach(dateKey => {
            if (result[dateKey] === undefined) {
                result[dateKey] = 0;
            }
        });

        return result;
    }, [transactions]);

    // Track Buy-only transactions (buys without paired sells)
    const dailyBuyOnly = useMemo(() => {
        const buyDates: Set<string> = new Set();

        transactions.forEach(tx => {
            if (tx.type === 'Buy' && !tx.relatedTransactionId) {
                const dateKey = format(new Date(tx.date), 'yyyy-MM-dd');
                buyDates.add(dateKey);
            }
        });

        return buyDates;
    }, [transactions]);

    // Get all Buy and Sell transactions for a specific day
    const getDayTransactions = (dateKey: string) => {
        return transactions.filter(tx => {
            if (tx.type === 'Sell' || tx.type === 'Buy') {
                return format(new Date(tx.date), 'yyyy-MM-dd') === dateKey;
            }
            return false;
        });
    };

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get starting day of week (0 = Sunday)
    const startingDayOfWeek = monthStart.getDay();

    // Calculate total PnL for the month
    const monthlyPnL = Object.entries(dailyPnL)
        .filter(([dateKey]) => {
            const date = new Date(dateKey);
            return isSameMonth(date, currentMonth);
        })
        .reduce((sum, [, pnl]) => sum + pnl, 0);

    const getPnLColor = (pnl: number | undefined, isBuyOnly: boolean) => {
        if (isBuyOnly) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'; // Buy-only, open position
        if (pnl === undefined) return 'bg-muted/20 text-muted-foreground';
        if (pnl === 0) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'; // Sell-only, no PnL
        if (pnl > 0) return 'bg-green-500/20 text-green-500 border-green-500/30';
        return 'bg-red-500/20 text-red-500 border-red-500/30';
    };

    return (
        <div className="space-y-4">
            {/* Month Navigation */}
            <Card className="bg-card border-border">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-foreground">
                                {format(currentMonth, 'MMMM yyyy')}
                            </h3>
                            <p className={`text-sm font-medium ${monthlyPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                Monthly P&L: {monthlyPnL >= 0 ? '+' : ''}{formatCurrency(monthlyPnL)}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {/* Day headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div
                                key={day}
                                className="text-center text-xs font-medium text-muted-foreground py-2"
                            >
                                {day}
                            </div>
                        ))}

                        {/* Empty cells for days before month start */}
                        {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="h-20" />
                        ))}

                        {/* Calendar days */}
                        {daysInMonth.map(day => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const pnl = dailyPnL[dateKey];
                            const isBuyOnly = dailyBuyOnly.has(dateKey);
                            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                            const dayTransactions = getDayTransactions(dateKey);

                            return (
                                <div
                                    key={dateKey}
                                    className={`
                                        relative h-20 border rounded-lg p-1.5 flex flex-col items-center justify-center
                                        transition-all cursor-pointer
                                        ${getPnLColor(pnl, isBuyOnly)}
                                        ${isToday ? 'ring-2 ring-primary' : 'border-border'}
                                        ${hoveredDay === dateKey ? 'scale-105 shadow-lg' : ''}
                                    `}
                                    onMouseEnter={() => setHoveredDay(dateKey)}
                                    onMouseLeave={() => setHoveredDay(null)}
                                >
                                    <div className="text-xs font-medium">
                                        {format(day, 'd')}
                                    </div>
                                    {pnl != null && pnl !== 0 && (
                                        <div className="text-xs font-bold mt-1">
                                            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                        </div>
                                    )}
                                    {pnl === 0 && dayTransactions.length > 0 && (
                                        <div className="text-xs font-medium mt-1 text-blue-400">
                                            Sell: {formatCurrency(dayTransactions.filter(t => t.type === 'Sell').reduce((sum, tx) => sum + (tx.amount * tx.price), 0))}
                                        </div>
                                    )}
                                    {isBuyOnly && dayTransactions.length > 0 && (
                                        <div className="text-xs font-medium mt-1 text-yellow-400">
                                            Buy: {formatCurrency(dayTransactions.filter(t => t.type === 'Buy').reduce((sum, tx) => sum + (tx.amount * tx.price), 0))}
                                        </div>
                                    )}

                                    {/* Hover Tooltip */}
                                    {hoveredDay === dateKey && dayTransactions.length > 0 && (
                                        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-popover border border-border rounded-lg shadow-xl p-3">
                                            <div className="text-xs font-semibold text-foreground mb-2">
                                                {format(day, 'MMM d, yyyy')}
                                            </div>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {dayTransactions.map((tx, idx) => (
                                                    <div key={idx} className="bg-muted/50 rounded p-2">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="font-mono text-xs font-medium text-foreground">
                                                                {tx.pair}
                                                            </span>
                                                            <span className={`text-xs font-bold ${tx.pnl && tx.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                {tx.pnl && tx.pnl >= 0 ? '+' : ''}{formatCurrency(tx.pnl || 0)}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {tx.amount} @ {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 10 }).format(tx.price)}
                                                        </div>
                                                        {tx.apr != null && (
                                                            <div className="text-xs text-muted-foreground">
                                                                APR: {tx.apr.toFixed(2)}%
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Arrow */}
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
