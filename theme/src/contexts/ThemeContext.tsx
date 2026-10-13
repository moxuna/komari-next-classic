"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type ColorTheme = 'default' | 'ocean' | 'sunset' | 'forest' | 'midnight' | 'rose';
export type CardLayout = 'classic' | 'modern' | 'minimal' | 'detailed';

interface ThemeConfig {
  colorTheme: ColorTheme;
  cardLayout: CardLayout;
  backgroundImageUrl?: string;
  logoImageUrl?: string;
  showAssetCalculatorButton?: boolean;
  /** 当前时间卡片/时间明细使用的时区（原版功能，存 localStorage，可由后台托管设置覆盖） */
  selectedTimeZone?: string;
}


interface StatusCardsVisibility {
  currentTime: boolean;
  currentOnline: boolean;
  regionOverview: boolean;
  trafficOverview: boolean;
  networkSpeed: boolean;
  latencyOverview: boolean;
  lossOverview: boolean;
  assetOverview: boolean;
}

interface ManagedThemeSettings {
  colorTheme?: ColorTheme;
  cardLayout?: CardLayout;
  backgroundImageUrl?: string;
  logoImageUrl?: string;
  showAssetCalculatorButton?: boolean;
  selectedTimeZone?: string;
  statusCardsVisibility?: Partial<StatusCardsVisibility>;
}

interface ThemeContextType {
  themeConfig: ThemeConfig;
  managedThemeSettings: ManagedThemeSettings;
  setColorTheme: (theme: ColorTheme) => void;
  setCardLayout: (layout: CardLayout) => void;
  setBackgroundImageUrl: (url: string) => void;
  setLogoImageUrl: (url: string) => void;
  statusCardsVisibility: StatusCardsVisibility;
  showAssetCalculatorButton: boolean;
  setSelectedTimeZone: (timeZone: string) => void;
  setStatusCardsVisibility: (value: StatusCardsVisibility) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'komari-theme-config';

const DEFAULT_THEME_CONFIG: ThemeConfig = {
  colorTheme: 'default',
  cardLayout: 'classic',
  backgroundImageUrl: '',
  logoImageUrl: '',
  showAssetCalculatorButton: true,
  selectedTimeZone: 'Asia/Shanghai',
};


const DEFAULT_STATUS_VISIBILITY: StatusCardsVisibility = {
  currentTime: true,
  currentOnline: true,
  regionOverview: true,
  trafficOverview: true,
  networkSpeed: true,
  latencyOverview: false,
  lossOverview: false,
  assetOverview: true,
};

function normalizeManagedThemeSettings(input: any): ManagedThemeSettings {
  if (!input || typeof input !== 'object') return {};

  const result: ManagedThemeSettings = {};

  if (typeof input.colorTheme === 'string') result.colorTheme = input.colorTheme as ColorTheme;
  if (typeof input.cardLayout === 'string') result.cardLayout = input.cardLayout as CardLayout;
  if (typeof input.backgroundImageUrl === 'string') result.backgroundImageUrl = input.backgroundImageUrl;
  if (typeof input.logoImageUrl === 'string') result.logoImageUrl = input.logoImageUrl;
  if (typeof input.showAssetCalculatorButton === 'boolean') result.showAssetCalculatorButton = input.showAssetCalculatorButton;
  if (typeof input.selectedTimeZone === 'string') result.selectedTimeZone = input.selectedTimeZone;

  if (input.statusCardsVisibility && typeof input.statusCardsVisibility === 'object') {
    result.statusCardsVisibility = {
      ...DEFAULT_STATUS_VISIBILITY,
      ...input.statusCardsVisibility,
    };
  }

  return result;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [localThemeConfig, setLocalThemeConfig] = useState<ThemeConfig>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            colorTheme: parsed.colorTheme || 'default',
            cardLayout: parsed.cardLayout || 'classic',
            backgroundImageUrl: parsed.backgroundImageUrl || '',
            logoImageUrl: parsed.logoImageUrl || '',
            showAssetCalculatorButton: parsed.showAssetCalculatorButton ?? true,
            selectedTimeZone: parsed.selectedTimeZone || 'Asia/Shanghai',
          };
        } catch {
          return DEFAULT_THEME_CONFIG;
        }
      }
    }
    return DEFAULT_THEME_CONFIG;
  });

  const [localStatusCardsVisibility, setLocalStatusCardsVisibility] = useLocalStorage<StatusCardsVisibility>('statusCardsVisibility', DEFAULT_STATUS_VISIBILITY);

  const [managedThemeSettings, setManagedThemeSettings] = useState<ManagedThemeSettings>({});

  useEffect(() => {
    let mounted = true;
    fetch('/api/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((resp) => {
        if (!mounted) return;
        setManagedThemeSettings(normalizeManagedThemeSettings(resp?.data?.theme_settings));
      })
      .catch(() => {
        if (!mounted) return;
        setManagedThemeSettings({});
      });
    return () => {
      mounted = false;
    };
  }, []);

  const themeConfig: ThemeConfig = {
    colorTheme: managedThemeSettings.colorTheme ?? localThemeConfig.colorTheme ?? DEFAULT_THEME_CONFIG.colorTheme,
    cardLayout: managedThemeSettings.cardLayout ?? localThemeConfig.cardLayout ?? DEFAULT_THEME_CONFIG.cardLayout,
    backgroundImageUrl: managedThemeSettings.backgroundImageUrl ?? localThemeConfig.backgroundImageUrl ?? '',
    logoImageUrl: managedThemeSettings.logoImageUrl ?? localThemeConfig.logoImageUrl ?? '',
    showAssetCalculatorButton: managedThemeSettings.showAssetCalculatorButton ?? localThemeConfig.showAssetCalculatorButton ?? true,
    selectedTimeZone: managedThemeSettings.selectedTimeZone ?? localThemeConfig.selectedTimeZone ?? DEFAULT_THEME_CONFIG.selectedTimeZone,
  };


  const statusCardsVisibility: StatusCardsVisibility = {
    ...DEFAULT_STATUS_VISIBILITY,
    ...localStatusCardsVisibility,
    ...(managedThemeSettings.statusCardsVisibility || {}),
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(localThemeConfig));
    }
  }, [localThemeConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-color-theme', themeConfig.colorTheme);
  }, [themeConfig.colorTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bgUrl = themeConfig.backgroundImageUrl || '';
    const body = document.body as HTMLBodyElement & { dataset: DOMStringMap };
    if (body.dataset.komariBgUrl === bgUrl) return;
    body.dataset.komariBgUrl = bgUrl;
    if (bgUrl) {
      const apply = () => {
        body.dataset.komariCustomBg = '1';
        body.style.setProperty('--komari-bg-image', `url(${bgUrl})`);
        body.style.backgroundImage = 'none';
      };
      const img = new Image();
      img.onload = apply;
      img.onerror = apply;
      img.src = bgUrl;
    } else {
      delete body.dataset.komariCustomBg;
      body.style.removeProperty('--komari-bg-image');
      body.style.backgroundImage = '';
    }
  }, [themeConfig.backgroundImageUrl]);

  const setColorTheme = (theme: ColorTheme) => setLocalThemeConfig(prev => ({ ...prev, colorTheme: theme }));
  const setCardLayout = (layout: CardLayout) => setLocalThemeConfig(prev => ({ ...prev, cardLayout: layout }));
  const setBackgroundImageUrl = (url: string) => setLocalThemeConfig(prev => ({ ...prev, backgroundImageUrl: url }));
  const setLogoImageUrl = (url: string) => setLocalThemeConfig(prev => ({ ...prev, logoImageUrl: url }));
  const setSelectedTimeZone = (timeZone: string) => setLocalThemeConfig(prev => ({ ...prev, selectedTimeZone: timeZone }));

  return (
    <ThemeContext.Provider value={{ themeConfig, managedThemeSettings, setColorTheme, setCardLayout, setBackgroundImageUrl, setLogoImageUrl, statusCardsVisibility, showAssetCalculatorButton: themeConfig.showAssetCalculatorButton ?? true, setStatusCardsVisibility: setLocalStatusCardsVisibility, setSelectedTimeZone }}>
      {children}
    </ThemeContext.Provider>
  );
};
