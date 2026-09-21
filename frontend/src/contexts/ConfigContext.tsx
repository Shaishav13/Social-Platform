import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import type { PlatformFeatures, PlatformSettings } from '../types';

interface ConfigContextType {
  features: PlatformFeatures;
  settings: PlatformSettings;
  isLoading: boolean;
  refreshConfig: () => Promise<void>;
}

const defaultFeatures: PlatformFeatures = {
  publicRegistration: true,
  mediaUploads: true,
  commenting: true,
  followRequests: true,
  maintenanceMode: false,
  trendingFeed: true,
};

const defaultSettings: PlatformSettings = {
  siteName: 'UdtaBirdie',
  announcementBanner: '',
  defaultDensity: 'comfortable',
  maxPostLength: 2000,
  rateLimitMaxRequests: 100,
};

const ConfigContext = createContext<ConfigContextType>({
  features: defaultFeatures,
  settings: defaultSettings,
  isLoading: true,
  refreshConfig: async () => {},
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<PlatformFeatures>(defaultFeatures);
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const refreshConfig = async () => {
    try {
      const res = await api.get('/config');
      if (res.data?.success) {
        if (res.data.features) setFeatures(res.data.features);
        if (res.data.settings) {
          setSettings((prev) => ({
            ...prev,
            ...res.data.settings,
          }));
        }
      }
    } catch (e) {
      // Graceful fallback to defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ features, settings, isLoading, refreshConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
