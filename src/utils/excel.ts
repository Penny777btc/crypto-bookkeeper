import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Wallets');

    // Use the library's writeFile for XLSX which was reported to work previously
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const downloadTemplate = () => {
    const templateData = [
        {
            Name: 'My Wallet',
            'Chain Type': 'evm',
            Address: '0x123...',
            Tags: 'personal, defi'
        },
        {
            Name: 'Solana Wallet',
            'Chain Type': 'solana',
            Address: 'Hv3...',
            Tags: 'trading'
        },
        {
            Name: 'Bitcoin Vault',
            'Chain Type': 'bitcoin',
            Address: 'bc1q...',
            Tags: 'cold storage'
        }
    ];
    exportToExcel(templateData, 'wallet_template');
};
