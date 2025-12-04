import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui';
import { Languages } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'zh' ? 'en' : 'zh';
        i18n.changeLanguage(newLang);
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="flex items-center gap-2"
        >
            <Languages className="h-4 w-4" />
            <span className="text-xs font-medium">
                {i18n.language === 'zh' ? 'English' : '中文'}
            </span>
        </Button>
    );
};
