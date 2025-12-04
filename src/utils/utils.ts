import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: any, currency: string = 'USD') {
    const value = Number(amount);
    if (isNaN(value)) return '---';

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(value);
    } catch (e) {
        console.error('Error formatting currency:', e);
        return '---';
    }
}

export function formatCurrencyWithMask(amount: any, hideAmounts: boolean, currency: string = 'USD') {
    if (hideAmounts) return '****';
    return formatCurrency(amount, currency);
}

