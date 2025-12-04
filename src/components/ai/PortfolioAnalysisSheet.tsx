import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sheet } from '../ui/sheet';
import { useStore } from '../../store/useStore';
import { Bot, Send, Settings, Key, Loader2, PieChart } from 'lucide-react';
import { Button, Input } from '../ui';
import { formatCurrency } from '../../utils/utils';

interface PortfolioItem {
    name: string;
    value: number;
    percentage: number;
}

interface PortfolioAnalysisSheetProps {
    isOpen: boolean;
    onClose: () => void;
    data: PortfolioItem[];
    totalValue: number;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export const PortfolioAnalysisSheet: React.FC<PortfolioAnalysisSheetProps> = ({ isOpen, onClose, data, totalValue }) => {
    const { aiConfig, setAiConfig } = useStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [tempKey, setTempKey] = useState(aiConfig.apiKey || '');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial Analysis
    useEffect(() => {
        if (isOpen && data.length > 0 && messages.length === 0) {
            if (aiConfig.apiKey) {
                // If API key exists, trigger AI analysis automatically
                handleSendMessage('请分析我的当前持仓');
            } else {
                // If no API key, generate local rule-based analysis
                const localAnalysis = generateLocalPortfolioAnalysis(data, totalValue);
                setMessages([{ role: 'assistant', content: localAnalysis }]);
            }
        }
    }, [isOpen, data, aiConfig.apiKey]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const generateLocalPortfolioAnalysis = (items: PortfolioItem[], total: number): string => {
        // Simple rule-based analysis
        const btc = items.find(i => i.name.toUpperCase() === 'BTC');
        const eth = items.find(i => i.name.toUpperCase() === 'ETH');
        const stables = items.filter(i => ['USDT', 'USDC', 'DAI', 'FDUSD'].includes(i.name.toUpperCase()));
        const stableValue = stables.reduce((acc, s) => acc + s.value, 0);
        const stableRatio = (stableValue / total) * 100;

        const btcRatio = btc ? btc.percentage : 0;
        const ethRatio = eth ? eth.percentage : 0;
        const majorRatio = btcRatio + ethRatio;
        const altRatio = 100 - majorRatio - stableRatio;

        let healthCheck = '';
        if (majorRatio > 50) healthCheck = '✅ **核心资产稳固**：BTC/ETH 占比超过 50%，组合抗风险能力较强。';
        else if (majorRatio < 30) healthCheck = '⚠️ **核心资产不足**：BTC/ETH 占比低于 30%，组合波动性可能较大。';
        else healthCheck = '⚖️ **结构平衡**：核心资产占比适中。';

        let liquidityCheck = '';
        if (stableRatio > 20) liquidityCheck = '✅ **流动性充足**：稳定币储备充足 (>20%)，有抄底能力。';
        else if (stableRatio < 5) liquidityCheck = '⚠️ **流动性紧张**：稳定币不足 (<5%)，应对极端行情能力较弱。';
        else liquidityCheck = '⚖️ **流动性适中**：保持了一定的流动性储备。';

        return `### 🤖 基础持仓诊断 (本地模式)
*配置 API Key 可解锁深度 AI 分析*

#### 1. 仓位结构
* **BTC/ETH**: ${majorRatio.toFixed(1)}%
* **稳定币**: ${stableRatio.toFixed(1)}%
* **山寨/其他**: ${altRatio.toFixed(1)}%

#### 2. 健康度检查
* ${healthCheck}
* ${liquidityCheck}

#### 3. 建议
* **配置 API Key**：点击右上角设置图标，输入 OpenAI API Key 以获取基于现代投资组合理论的深度分析。
`;
    };

    const handleSaveConfig = () => {
        setAiConfig({ apiKey: tempKey });
        setIsConfiguring(false);
    };

    const handleSendMessage = async (customPrompt?: string) => {
        const userMsg = customPrompt || input;
        if (!userMsg.trim()) return;

        if (!customPrompt) {
            setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
            setInput('');
        }

        setIsAnalyzing(true);

        try {
            const baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1';
            const model = aiConfig.model || 'gpt-3.5-turbo';

            // Format Portfolio Data
            const portfolioText = data.map((item, index) =>
                `${index + 1}. ${item.name} / ${item.percentage.toFixed(2)}%`
            ).join('\n');

            const systemPrompt = `# Role
你是一位拥有10年经验的加密货币资深投资分析师和资产组合经理。你擅长使用“核心-卫星”策略（Core-Satellite Strategy）和现代投资组合理论（MPT）来评估加密资产的风险与收益。

# Goal
请根据我提供的持仓数据，从专业的投资逻辑出发，深度分析我当前账户的仓位占比合理性，指出潜在的风险点，并给出具体的优化调整建议。

# Input Data (我的持仓)
请基于以下数据进行分析（如果数据不完整，请基于现有信息估算）：
${portfolioText}

# Analysis Framework (分析维度)
请严格按照以下逻辑进行拆解：

1. **宏观仓位结构健康度 (Health Check)**
   - **大盘 vs 山寨占比**：分析 BTC/ETH 等“压舱石”资产与高波动山寨币的比例是否失衡。
   - **U本位储备 (Stablecoin Ratio)**：当前的空仓/稳定币占比是否足以应对极端行情或支持抄底。

2. **赛道与叙事分布 (Sector Allocation)**
   - **赛道集中度**：我是否过度押注在某一个单一赛道（如全是 Meme 或全是 AI）？
   - **叙事相关性**：持仓的代币是否符合当前或未来的市场主流叙事？是否存在过时资产（僵尸币）？

3. **风险敞口评估 (Risk Assessment)**
   - **波动性分析**：基于当前配置，预估组合在市场下行时的抗跌能力。
   - **相关性风险**：持有的资产是否存在高度联动（例如同一个生态系的代币），导致系统性风险过高。

4. **问题诊断 (Problems Identification)**
   - 请直接指出当前仓位最大的三个致命弱点（例如：过于激进、流动性差、由于过度分散导致的收益磨损等）。

# Deliverable (输出要求)
请以专业的研报风格输出，最后必须包含一个**【优化操作建议表】**，分为：
- **建议减持/清仓**：逻辑是什么？
- **建议增持/关注**：为了平衡风险或捕捉Alpha，建议关注哪些类型的资产？
- **理想仓位模型**：基于我的风险偏好（假设为中等偏激进），给出一个推荐的理想百分比模型。

请用中文回答，格式清晰，重点加粗。`;

            const apiMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
                ...(customPrompt ? [{ role: 'user', content: customPrompt }] : [])
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

            const resData = await response.json();
            const aiContent = resData.choices[0]?.message?.content || "I couldn't generate a response.";

            setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
        } catch (error: any) {
            console.error('AI API Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}. Please check your API key and settings.` }]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <Sheet isOpen={isOpen} onClose={onClose} title="Portfolio AI Analysis" className="w-full max-w-lg sm:max-w-xl">
            <div className="flex flex-col h-full space-y-4">
                {/* Portfolio Summary */}
                <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-2 font-medium">
                        <PieChart className="h-4 w-4" />
                        Current Portfolio
                    </div>
                    <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                        {data.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                                <span>{item.name}</span>
                                <span className="text-muted-foreground">{item.percentage.toFixed(2)}% ({formatCurrency(item.value)})</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="flex-1 flex flex-col min-h-[300px] border rounded-lg overflow-hidden bg-background">
                    <div className="p-3 border-b bg-muted/30 flex justify-between items-center">
                        <div className="flex items-center gap-2 font-medium text-sm">
                            <Bot className="h-4 w-4 text-primary" />
                            AI Investment Advisor
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
                                        <div className={`max-w-[90%] rounded-lg p-3 text-sm ${msg.role === 'user'
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
                                            Analyzing Portfolio...
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-3 border-t bg-background">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={aiConfig.apiKey ? "Ask follow-up questions..." : "Configure API key to chat..."}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        disabled={!aiConfig.apiKey || isAnalyzing}
                                    />
                                    <Button size="icon" onClick={() => handleSendMessage()} disabled={!aiConfig.apiKey || isAnalyzing}>
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
