import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { fetchCoinGeckoPrices } from '../../utils/coinGecko';
import { Button, Input, Select } from '../ui';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { ManualAsset } from '../../types';

export const ManualAssetsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { manualAssets, addManualAsset, updateManualAsset, removeManualAsset } = useStore();

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        exchange: '',
        symbol: '',
        amount: '',
        note: ''
    });
    const [prices, setPrices] = useState<Record<string, number>>({});

    // Fetch prices for all manual assets
    useEffect(() => {
        const fetchPrices = async () => {
            if (manualAssets.length === 0) return;

            const symbols = [...new Set(manualAssets.map(a => a.symbol.toUpperCase()))];
            const priceMap = await fetchCoinGeckoPrices(symbols);
            setPrices(priceMap);
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [manualAssets]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.exchange || !formData.symbol || !formData.amount) return;

        const asset = {
            exchange: formData.exchange,
            symbol: formData.symbol.toUpperCase(),
            amount: parseFloat(formData.amount),
            note: formData.note || undefined
        };

        if (editingId) {
            updateManualAsset(editingId, asset);
            setEditingId(null);
        } else {
            addManualAsset(asset);
        }

        setFormData({ exchange: '', symbol: '', amount: '', note: '' });
        setShowForm(false);
    };

    const handleEdit = (asset: ManualAsset) => {
        setFormData({
            exchange: asset.exchange,
            symbol: asset.symbol,
            amount: asset.amount.toString(),
            note: asset.note || ''
        });
        setEditingId(asset.id);
        setShowForm(true);
    };

    const handleCancel = () => {
        setFormData({ exchange: '', symbol: '', amount: '', note: '' });
        setEditingId(null);
        setShowForm(false);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    return (
        <>
            {showForm && (
                <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-muted/50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('manual_assets.exchange', 'Exchange')} *
                            </label>
                            <Select
                                value={formData.exchange}
                                onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                                required
                            >
                                <option value="">{t('common.select', 'Select...')}</option>
                                <option value="Bybit">Bybit</option>
                                <option value="OKX">OKX</option>
                                <option value="Binance">Binance</option>
                                <option value="Other">{t('common.other', 'Other')}</option>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('manual_assets.symbol', 'Symbol')} *
                            </label>
                            <Input
                                type="text"
                                placeholder="BTC, ETH, SOL..."
                                value={formData.symbol}
                                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('manual_assets.amount', 'Amount')} *
                            </label>
                            <Input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('manual_assets.note', 'Note (Optional)')}
                            </label>
                            <Input
                                type="text"
                                placeholder={t('manual_assets.note_placeholder', 'e.g., Locked Staking')}
                                value={formData.note}
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="ghost" onClick={handleCancel}>
                            {t('common.cancel', 'Cancel')}
                        </Button>
                        <Button type="submit">
                            <Check className="h-4 w-4 mr-2" />
                            {editingId ? t('common.update', 'Update') : t('common.add', 'Add')}
                        </Button>
                    </div>
                </form>
            )}

            <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-muted-foreground">
                    {manualAssets.length} {t('manual_assets.assets_count', 'assets')}
                </span>
                <Button onClick={() => setShowForm(!showForm)} size="sm">
                    {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    {showForm ? t('common.cancel', 'Cancel') : t('manual_assets.add_new', 'Add Asset')}
                </Button>
            </div>

            {manualAssets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p>{t('manual_assets.empty', 'No manual assets added yet.')}</p>
                    <p className="text-sm mt-2">
                        {t('manual_assets.empty_hint', 'Click "Add Asset" to record assets not captured by API.')}
                    </p>
                </div>
            ) : (
                <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-3 text-left font-medium">{t('manual_assets.exchange', 'Exchange')}</th>
                                <th className="p-3 text-left font-medium">{t('manual_assets.symbol', 'Symbol')}</th>
                                <th className="p-3 text-right font-medium">{t('manual_assets.amount', 'Amount')}</th>
                                <th className="p-3 text-right font-medium">{t('manual_assets.price', 'Price')}</th>
                                <th className="p-3 text-right font-medium">{t('manual_assets.value', 'Value')}</th>
                                <th className="p-3 text-left font-medium">{t('manual_assets.note', 'Note')}</th>
                                <th className="p-3 text-center font-medium">{t('common.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {manualAssets.map((asset) => {
                                const price = prices[asset.symbol.toUpperCase()] || 0;
                                const value = asset.amount * price;

                                return (
                                    <tr key={asset.id} className="border-t hover:bg-muted/50">
                                        <td className="p-3">{asset.exchange}</td>
                                        <td className="p-3 font-medium">{asset.symbol}</td>
                                        <td className="p-3 text-right">{asset.amount.toFixed(4)}</td>
                                        <td className="p-3 text-right text-muted-foreground">
                                            {price > 0 ? formatCurrency(price) : '-'}
                                        </td>
                                        <td className="p-3 text-right font-semibold">
                                            {price > 0 ? formatCurrency(value) : '-'}
                                        </td>
                                        <td className="p-3 text-sm text-muted-foreground">
                                            {asset.note || '-'}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2 justify-center">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleEdit(asset)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        if (window.confirm(t('manual_assets.confirm_delete', 'Are you sure you want to delete this asset?'))) {
                                                            removeManualAsset(asset.id);
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
};
