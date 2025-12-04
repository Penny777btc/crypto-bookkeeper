import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle, Button } from './ui';
import { Download, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const BackupSettings: React.FC = () => {
    const { exportData, importData } = useStore();
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        exportData();
    };

    const handleImport = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const jsonData = event.target?.result as string;
            const success = importData(jsonData);
            setImportStatus(success ? 'success' : 'error');
            setTimeout(() => setImportStatus('idle'), 3000);
        };
        reader.readAsText(file);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>数据备份与恢复</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Warning */}
                <div className="flex gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                        <p className="font-medium text-yellow-600 dark:text-yellow-500">安全提示</p>
                        <p className="text-muted-foreground">
                            备份文件包含您的 API Keys 和所有敏感数据，请妥善保管备份文件，切勿分享给他人。
                        </p>
                    </div>
                </div>

                {/* Export */}
                <div className="space-y-2">
                    <h3 className="font-medium">导出数据</h3>
                    <p className="text-sm text-muted-foreground">
                        将所有配置和数据导出为 JSON 文件，包括 CEX API、交易记录、钱包地址等。
                    </p>
                    <Button onClick={handleExport} className="w-full">
                        <Download className="mr-2 h-4 w-4" />
                        导出备份文件
                    </Button>
                </div>

                <div className="border-t pt-4">
                    {/* Import */}
                    <div className="space-y-2">
                        <h3 className="font-medium">导入数据</h3>
                        <p className="text-sm text-muted-foreground">
                            从备份文件恢复数据。注意：导入会覆盖当前所有数据。
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <Button onClick={handleImport} variant="outline" className="w-full">
                            <Upload className="mr-2 h-4 w-4" />
                            选择备份文件导入
                        </Button>

                        {/* Status Messages */}
                        {importStatus === 'success' && (
                            <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-600 dark:text-green-500 text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                数据导入成功！页面即将刷新...
                            </div>
                        )}
                        {importStatus === 'error' && (
                            <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-600 dark:text-red-500 text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                导入失败，请检查文件格式是否正确。
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
