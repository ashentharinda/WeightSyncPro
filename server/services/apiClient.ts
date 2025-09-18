import { EventEmitter } from 'events';

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}

export interface WeighmentData {
  tagId: string;
  weight: number;
  tareWeight: number;
  netWeight: number;
  lorryNumber: string;
  timestamp: Date;
}

export class APIClient extends EventEmitter {
  private config: {
    endpoint: string;
    authMethod: string;
    apiKey: string;
    syncInterval: number;
    retryAttempts: number;
  };
  private connected: boolean = false;
  private syncTimer?: NodeJS.Timeout;

  constructor(config: any) {
    super();
    this.config = {
      endpoint: config.endpoint || process.env.API_ENDPOINT || 'http://localhost:3000/api', // Default for development
      authMethod: config.authMethod || 'bearer',
      apiKey: config.apiKey || process.env.API_KEY || 'demo-api-key',
      syncInterval: config.syncInterval || 30000, // 30 seconds
      retryAttempts: config.retryAttempts || 3
    };
  }

  async testConnection(): Promise<APIResponse> {
    try {
      if (!this.config.endpoint || this.config.endpoint === 'http://localhost:3000/api') {
        // Use demo mode for development
        const response: APIResponse = {
          success: true,
          data: { status: 'demo-mode', version: '1.0', message: 'Using demo configuration' },
          timestamp: new Date()
        };

        this.connected = true;
        this.emit('connect');
        return response;
      }

      // Simulate API connection test
      const response: APIResponse = {
        success: true,
        data: { status: 'connected', version: '1.0' },
        timestamp: new Date()
      };

      this.connected = true;
      this.emit('connect');
      return response;

    } catch (error) {
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };

      this.connected = false;
      this.emit('error', error);
      return response;
    }
  }

  async syncWeighment(data: WeighmentData): Promise<APIResponse> {
    if (!this.connected) {
      await this.testConnection();
    }

    try {
      // Simulate API request with retry logic
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < this.config.retryAttempts) {
        try {
          // Simulate API call - replace with actual HTTP request
          await this.delay(100); // Simulate network delay
          
          const response: APIResponse = {
            success: true,
            data: { id: `sync_${Date.now()}`, status: 'synced' },
            timestamp: new Date()
          };

          this.emit('sync_success', { data, response });
          return response;

        } catch (error) {
          lastError = error as Error;
          attempt++;
          
          if (attempt < this.config.retryAttempts) {
            await this.delay(1000 * attempt); // Exponential backoff
          }
        }
      }

      throw lastError || new Error('Sync failed after retries');

    } catch (error) {
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        timestamp: new Date()
      };

      this.emit('sync_error', { data, error: response });
      return response;
    }
  }

  startAutoSync(): void {
    if (this.syncTimer) {
      this.stopAutoSync();
    }

    this.syncTimer = setInterval(async () => {
      this.emit('auto_sync_tick');
    }, this.config.syncInterval);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  updateConfig(newConfig: any): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto sync if interval changed
    if (this.syncTimer) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConfig() {
    return { ...this.config };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const apiClient = new APIClient({
  endpoint: process.env.API_ENDPOINT,
  apiKey: process.env.API_KEY,
  syncInterval: parseInt(process.env.API_SYNC_INTERVAL || '30000'),
  retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS || '3')
});
