export interface AppConfig {
  scraping: {
    host: string;
    propertyTypes: string[];
    concurrencyLimit: number;
    rateLimitDelay: number;
  };
  storage: {
    outputDir: string;
    htmlDir: string;
  };
  ai: {
    model: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export const defaultConfig: AppConfig = {
  scraping: {
    host: 'https://www.sspc.co.uk',
    propertyTypes: ['House', 'Flat', 'Bungalow'],
    concurrencyLimit: 5,
    rateLimitDelay: 1000, // 1 second delay between requests
  },
  storage: {
    outputDir: './',
    htmlDir: 'properties',
  },
  ai: {
    model: 'gpt-3.5-turbo',
    maxTokens: 150,
    temperature: 0.1,
  },
};

export function loadConfig(): AppConfig {
  // In future, this could load from environment variables or config files
  return defaultConfig;
}