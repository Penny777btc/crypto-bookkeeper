import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
}

export function formatNumber(amount: number, maximumSignificantDigits: number = 6) {
    return new Intl.NumberFormat('en-US', {
        maximumSignificantDigits: maximumSignificantDigits
    }).format(amount);
}
