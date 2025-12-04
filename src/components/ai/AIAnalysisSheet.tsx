import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sheet } from '../ui/sheet';
import { useStore } from '../../store/useStore';
import { getCoinId, fetchMarketChart, fetchCoinMarketData, searchCoin } from '../../utils/cryptoUtils';
import { calculateRSI, calculateSMA } from '../../utils/indicators';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { Send, Settings, Key, Loader2, TrendingUp, Bot } from 'lucide-react';
import { Button, Input } from '../ui';
import { formatCurrency } from '../../utils/utils';

interface AIAnalysisSheetProps {
    isOpen: boolean;
    onClose: () => void;
    symbol: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const AIAnalysisSheet: React.FC<AIAnalysisSheetProps> = ({ isOpen, onClose, symbol }) => {
    const { aiConfig, setAiConfig, transactions } = useStore();
    const [coinData, setCoinData] = useState<any>(null);
    const [rsiValue, setRsiValue] = useState<number | null>(null);
    const [ma200Value, setMa200Value] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [tempKey, setTempKey] = useState(aiConfig.apiKey || '');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && symbol) {
            loadMarketData();
        }
    }, [isOpen, symbol]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);



    const loadMarketData = async () => {
        let coinId = getCoinId(symbol);

        // If not found in static map, try dynamic search
        if (!coinId) {
            coinId = await searchCoin(symbol);
        }

        if (coinId) {
            // Fetch 200 days for MA200
            const prices = await fetchMarketChart(coinId, '200');
            const coinDetails = await fetchCoinMarketData(coinId);

            if (prices) {
                // Calculate Indicators
                const priceValues = prices.map((p: any) => p[1]);
                setRsiValue(calculateRSI(priceValues));
                setMa200Value(calculateSMA(priceValues, 200));
            }
            setCoinData(coinDetails);


            // Auto-generate initial analysis with the fetched data
            if (coinDetails && prices) {
                const priceValues = prices.map((p: any) => p[1]);
                const rsi = calculateRSI(priceValues) || 50;
                const ma200 = calculateSMA(priceValues, 200) || 0;
                generateInitialAnalysis(coinDetails, rsi, ma200);
            }
        }
    }




    const generateInitialAnalysis = (coinDetails: any, rsi: number, ma200: number) => {
        const analysisContent = generateLocalAnalysisWithData(coinDetails, rsi, ma200);
        setMessages([{
            role: 'assistant',
            content: analysisContent
        }]);
    };

    const generateLocalAnalysisWithData = (coinDetails: any, rsi: number, ma200: number): string => {
        const currentPrice = coinDetails?.current_price || 0;
        const change24h = coinDetails?.price_change_percentage_24h || 0;
        const athChange = coinDetails?.ath_change_percentage || 0;
        const volume = coinDetails?.total_volume || 0;

        // Determine RSI status
        let rsiStatus = '';
        if (rsi > 70) rsiStatus = '超买区间';
        else if (rsi < 30) rsiStatus = '超卖区间';
        else if (rsi >= 40 && rsi <= 60) rsiStatus = '中性区间';
        else rsiStatus = '正常波动';

        // Determine MA200 position
        const ma200Position = currentPrice > ma200 ? '均线之上 (多头排列)' : '均线之下 (空头排列)';

        // Determine 24h trend
        let trend24h = '';
        if (change24h > 5) trend24h = '强势上涨';
        else if (change24h > 0) trend24h = '小幅上涨';
        else if (change24h > -5) trend24h = '小幅下跌';
        else trend24h = '大幅下跌';

        // Capital flow analysis
        let capitalAnalysis = '';
        if (rsi < 30 && change24h < -5) {
            capitalAnalysis = '市场恐慌情绪明显，可能存在过度抛售，短期有反弹机会';
        } else if (rsi > 70 && change24h > 5) {
            capitalAnalysis = '市场情绪过热，追高风险较大，建议谨慎';
        } else {
            capitalAnalysis = '市场处于相对平稳状态，观望为主';
        }

        // Technical analysis
        let technicalAnalysis = '';
        if (rsi < 40 && currentPrice > ma200) {
            technicalAnalysis = 'RSI回调但价格仍在长期均线之上，可能是短期调整后的介入机会';
        } else if (rsi > 60 && currentPrice < ma200) {
            technicalAnalysis = 'RSI偏高但价格在均线之下，反弹可能受阻，注意压力位';
        } else if (currentPrice > ma200) {
            technicalAnalysis = '价格维持在MA200之上，中长期趋势偏多';
        } else {
            technicalAnalysis = '价格在MA200之下，中长期趋势偏空';
        }

        // Determine signal and suggestion
        let signal = '';
        let suggestion = '';
        if (rsi < 30 && change24h < -5) {
            signal = '**买入信号**';
            suggestion = '分批建仓，等待技术指标修复';
        } else if (rsi > 70 && change24h > 5) {
            signal = '**卖出信号**';
            suggestion = '考虑分批止盈，锁定利润';
        } else if (rsi >= 40 && rsi <= 60) {
            signal = '**观望信号**';
            suggestion = '等待更明确的方向突破';
        } else {
            signal = '**持有信号**';
            suggestion = '维持现有仓位，关注关键支撑/压力位';
        }

        // Determine important events based on current date and market conditions
        const currentDate = new Date();
        const month = currentDate.getMonth() + 1;

        // Generate contextual market events
        let recentEvents = [];
        let upcomingMeetings = [];

        // Add relevant macro events based on market conditions
        if (change24h < -5) {
            recentEvents.push('市场出现明显回调，可能受宏观经济数据影响');
        }
        if (rsi < 30) {
            recentEvents.push('技术指标显示超卖，可能因恐慌性抛售');
        }

        // Add seasonal/periodic events with specific dates
        if (month === 12) {
            recentEvents.push('年末机构调仓窗口期，流动性可能波动');
            upcomingMeetings.push(`美联储FOMC会议 (12月17-18日)`);
            upcomingMeetings.push(`美国CPI数据发布 (12月11日 21:30 UTC)`);
        } else if (month === 1) {
            recentEvents.push('新年度开始，机构调整配置');
            upcomingMeetings.push(`美联储FOMC会议 (1月28-29日)`);
            upcomingMeetings.push(`美国非农就业数据 (每月第一个周五)`);
        } else if (month === 3) {
            upcomingMeetings.push(`美联储FOMC会议 (3月中旬)`);
            upcomingMeetings.push(`季度期权交割日 (3月最后一个周五)`);
        } else if (month === 6) {
            upcomingMeetings.push(`美联储FOMC会议 (6月中旬)`);
            upcomingMeetings.push(`季度期权交割日 (6月最后一个周五)`);
        } else if (month === 9) {
            upcomingMeetings.push(`美联储FOMC会议 (9月中旬)`);
            upcomingMeetings.push(`季度期权交割日 (9月最后一个周五)`);
        }

        // Always include general macro factors with timing
        recentEvents.push('关注美国CPI/非农数据对加密市场的影响');
        upcomingMeetings.push(`美国CPI数据 (每月10-15日公布)`);
        upcomingMeetings.push(`美联储官员讲话 (关注政策信号)`);


        return `### 📊 关键数据概览
* **当前价格**: $${formatCurrency(currentPrice)} (${change24h > 0 ? '↗️' : '↘️'} 24h: **${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%**)

* **RSI (14)**: **${rsi.toFixed(1)}** (${rsiStatus})

* **MA200 位置**: ${ma200Position} (MA200: $${formatCurrency(ma200)})

* **24小时走势**: ${trend24h}

* **距离 ATH**: **${athChange.toFixed(1)}%**

* **24小时成交量**: $${(volume / 1e9).toFixed(2)}B

### 🧠 深度分析
* **资金面**: ${capitalAnalysis}
* **技术面**: ${technicalAnalysis}

### 📅 近期关注事项
**可能影响因素**:
${recentEvents.map(e => `* ${e}`).join('\n')}

**重要会议/事件**:
${upcomingMeetings.map(m => `* ${m}`).join('\n')}

### 💡 结论与建议
* **当前信号**: ${signal}
* **操作建议**: ${suggestion}`;
    };

    const getTradingViewSymbol = (symbol: string) => {
        // For major coins, prefer Binance to ensure stability
        const majorCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'TRX', 'DOT', 'LINK', 'MATIC', 'LTC', 'UNI', 'ATOM', 'ETC', 'FIL'];
        if (majorCoins.includes(symbol.toUpperCase())) {
            return `BINANCE:${symbol.toUpperCase()}USDT`;
        }
        // For others, let TradingView find the best match (e.g. Bybit, Coinbase, etc.)
        return `${symbol.toUpperCase()}USDT`;
    };

    const handleSaveConfig = () => {
        setAiConfig({ apiKey: tempKey });
        setIsConfiguring(false);
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');
        setIsAnalyzing(true);

        // Mock AI response for now if no real backend integration
        // In a real app, this would call the AI provider API
        try {
            const baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1';
            // Use gpt-3.5-turbo as a safe default if no model specified, or user can set gpt-4
            const model = aiConfig.model || 'gpt-3.5-turbo';

            // Calculate User Position
            const userTx = transactions.filter(t => t.pair.startsWith(symbol + '/'));
            const totalCost = userTx.reduce((acc, t) => acc + (t.type === 'Buy' ? t.amount * t.price : 0), 0);
            const totalAmount = userTx.reduce((acc, t) => acc + (t.type === 'Buy' ? t.amount : -t.amount), 0);
            const avgCost = totalAmount > 0 ? totalCost / totalAmount : 0;
            const currentPrice = coinData?.current_price || 0;
            const userPnL = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

            const systemPrompt = `# Role
你是一位拥有10年经验的加密货币量化交易分析师。你擅长结合链上数据、技术指标和宏观情绪来判断现货（Spot）的交易时机。你的风格是客观、谨慎且数据驱动。

# Context (由软件实时填入)
用户正在关注代币： ${symbol}
当前时间： ${new Date().toLocaleString()}

以下是实时市场数据：
1. **价格表现**：
   - 当前价格： ${formatCurrency(currentPrice)}
   - 24小时涨跌幅： ${coinData?.price_change_percentage_24h?.toFixed(2) || 'N/A'}%
   - 距离历史最高点(ATH)： ${coinData?.ath_change_percentage?.toFixed(2) || 'N/A'}%

2. **技术指标 (日线级别)**：
   - RSI (14)： ${rsiValue?.toFixed(2) || 'N/A'}
   - 价格与 MA200 关系： ${ma200Value ? (currentPrice > ma200Value ? '价格位于均线之上 (Bullish)' : '价格位于均线之下 (Bearish)') : 'N/A'}
   - 24小时成交量变化： ${coinData?.total_volume ? formatCurrency(coinData.total_volume) : 'N/A'}

3. **资金流向 (关键)**：
   - 交易所最近24小时净流向： N/A (需高级API)
   - 大单交易 (Whale Activity)： N/A (需高级API)

4. **用户持仓情况**：
   - 用户平均持仓成本： ${formatCurrency(avgCost)}
   - 当前持仓盈亏： ${userPnL.toFixed(2)}%

# Task
请根据上述数据，为一个现货交易者生成一份简短的分析报告。

# Constraints & Output Format
1. **不要**直接给出“买入”或“卖出”的绝对指令（以避免合规风险），而是使用“累积筹码”、“分批止盈”、“观望”、“持有”等专业术语。
2. **格式要求**：
   - **市场情绪诊断**：用一句话总结当前市场是贪婪、恐惧还是中性。
   - **多空因素分析**：列出支持买入的因素（利多）和支持卖出的因素（利空）。
   - **操作建议**：
     - 如果当前是买入机会，请建议分批建仓的区间。
     - 如果当前是卖出机会，请建议止盈的比例。
   - **风险提示**：指出当前最大的一个风险点（如RSI过高、流动性不足等）。

3. 请用中文回答，字数控制在 200-300 字以内，条理清晰，重点加粗。`;

            const apiMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: userMsg }
            ];

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: apiMessages,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
            }

            const data = await response.json();
            const aiContent = data.choices[0]?.message?.content || "I couldn't generate a response.";

            setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
        } catch (error: any) {
            console.error('AI API Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}. Please check your API key and settings.` }]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <Sheet isOpen={isOpen} onClose={onClose} title={`AI Analysis: ${symbol}`} className="w-full max-w-lg sm:max-w-xl">
            <div className="flex flex-col h-full space-y-6">
                {/* Market Chart Section */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        Live Market Chart
                    </div>
                    <div className="h-[300px] border rounded-lg overflow-hidden">
                        <AdvancedRealTimeChart
                            symbol={getTradingViewSymbol(symbol)}
                            theme="dark"
                            autosize
                            hide_side_toolbar={true}
                            allow_symbol_change={false}
                            interval="D"
                        />
                    </div>
                </div>


                {/* Chat Interface */}
                <div className="flex-1 flex flex-col min-h-[300px] border rounded-lg overflow-hidden bg-background">
                    <div className="p-3 border-b bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2 font-medium text-sm">
                            <Bot className="h-4 w-4 text-primary" />
                            AI Assistant
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsConfiguring(!isConfiguring)}>
                            <Settings className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>

                    {isConfiguring ? (
                        <div className="p-4 space-y-4 bg-muted/10 flex-1">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">API Key</label>
                                    <div className="relative">
                                        <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="password"
                                            className="pl-9"
                                            placeholder="sk-..."
                                            value={tempKey}
                                            onChange={(e) => setTempKey(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Base URL (Optional)</label>
                                    <Input
                                        placeholder="https://api.openai.com/v1"
                                        value={aiConfig.baseUrl || ''}
                                        onChange={(e) => setAiConfig({ baseUrl: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Default: https://api.openai.com/v1
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Model Name (Optional)</label>
                                    <Input
                                        placeholder="gpt-3.5-turbo"
                                        value={aiConfig.model || ''}
                                        onChange={(e) => setAiConfig({ model: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        e.g., gpt-4, claude-3-opus, deepseek-chat
                                    </p>
                                </div>

                                <Button onClick={handleSaveConfig} className="w-full">
                                    Save Configuration
                                </Button>

                                <p className="text-xs text-muted-foreground text-center">
                                    Supports OpenAI, DeepSeek, OpenRouter, and other compatible APIs.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                            } prose prose-sm dark:prose-invert max-w-none`}>
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                ))}
                                {isAnalyzing && (
                                    <div className="flex justify-start">
                                        <div className="bg-muted rounded-lg p-3 text-sm flex items-center gap-2">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Thinking...
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-3 border-t bg-background">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={aiConfig.apiKey ? "Ask anything about this asset..." : "Configure API key to chat..."}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        disabled={!aiConfig.apiKey || isAnalyzing}
                                    />
                                    <Button size="icon" onClick={handleSendMessage} disabled={!aiConfig.apiKey || isAnalyzing}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Sheet>
    );
};
