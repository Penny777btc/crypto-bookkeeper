import React from 'react';
import { cn } from '../../utils/utils';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn("p-6 pt-0", className)} {...props} />
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'destructive' | 'ghost' }> = ({ className, variant = 'default', ...props }) => {
    const variants = {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
    };
    return (
        <button
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2",
                variants[variant],
                className
            )}
            {...props}
        />
    );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
    <input
        className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        {...props}
    />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, ...props }) => (
    <div className="relative">
        <select
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
                className
            )}
            {...props}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
        </div>
    </div>
);
