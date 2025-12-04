import React, { useState, useEffect } from 'react';
import { X, Key, Save, Bot, Database } from 'lucide-react';
import { cn } from '../../utils/utils';
import { useStore } from '../../store/useStore';
import { Button, Input, Select } from '../ui';
import { BackupSettings } from '../BackupSettings';

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
    const { aiConfig, setAiConfig } = useStore();
    const [isVisible, setIsVisible] = useState(isOpen);
    const [activeTab, setActiveTab] = useState<'ai' | 'backup'>('ai');

    // Local state for form
    const [apiKey, setApiKey] = useState(aiConfig.apiKey || '');
    const [provider, setProvider] = useState(aiConfig.provider || 'openai');
    const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl || '');
    const [model, setModel] = useState(aiConfig.model || '');

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Sync with store when opening
            setApiKey(aiConfig.apiKey || '');
            setProvider(aiConfig.provider || 'openai');
            setBaseUrl(aiConfig.baseUrl || '');
            setModel(aiConfig.model || '');
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen, aiConfig]);

    const handleSave = () => {
        setAiConfig({
            apiKey,
            provider: provider as any,
            baseUrl,
            model
        });
        onClose();
    };

    if (!isVisible && !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/50 transition-opacity duration-300 ease-in-out",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />

            {/* Dialog Panel */}
            <div
                className={cn(
                    "relative z-50 w-full max-w-md bg-background rounded-lg shadow-xl transition-all duration-300 ease-in-out transform border",
                    isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95"
                )}
            >
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2 font-semibold text-lg">
                        <Bot className="h-5 w-5" />
                        Settings
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-4 pt-4 border-b">
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={cn(
                            "px-4 py-2 rounded-t-lg border-b-2 transition-colors",
                            activeTab === 'ai'
                                ? "border-primary text-primary font-medium"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            AI Config
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('backup')}
                        className={cn(
                            "px-4 py-2 rounded-t-lg border-b-2 transition-colors",
                            activeTab === 'backup'
                                ? "border-primary text-primary font-medium"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Backup
                        </div>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {activeTab === 'ai' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">AI Configuration</h3>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Provider</label>
                                <Select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value as any)}
                                >
                                    <option value="openai">OpenAI</option>
                                    <option value="gemini">Google Gemini</option>
                                    <option value="claude">Anthropic Claude</option>
                                    <option value="custom">Custom (OpenAI Compatible)</option>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">API Key</label>
                                <div className="relative">
                                    <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="password"
                                        className="pl-9"
                                        placeholder="sk-..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Stored locally in your browser. Never sent to our servers.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Model (Optional)</label>
                                <Input
                                    placeholder={provider === 'openai' ? 'gpt-4o' : 'model-name'}
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                />
                            </div>

                            {(provider === 'custom' || provider === 'openai') && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Base URL (Optional)</label>
                                    <Input
                                        placeholder="https://api.openai.com/v1"
                                        value={baseUrl}
                                        onChange={(e) => setBaseUrl(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'backup' && (
                        <div>
                            <BackupSettings />
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-muted/20 flex justify-end gap-2 rounded-b-lg">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
};
