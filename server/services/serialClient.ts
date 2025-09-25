import { EventEmitter } from 'events';

export interface SerialReading {
  weight: number;
  unit: string;
  stable: boolean;
  timestamp: Date;
}

export class SerialClient extends EventEmitter {
  private connected: boolean = false;
  private config: {
    port: string;
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: string;
  };
  private simulationInterval?: NodeJS.Timeout;

  constructor(config: any) {
    super();
    this.config = {
      port: config.port || 'COM3',
      baudRate: config.baudRate || 9600,
      dataBits: config.dataBits || 8,
      stopBits: config.stopBits || 1,
      parity: config.parity || 'none'
    };
  }

  async connect(): Promise<void> {
    try {
      // Simulate serial connection - replace with actual serial port connection
      this.connected = true;
      this.emit('connect');
      
      // Start reading data
      this.startReading();
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private startReading(): void {
    // Simulate weight readings - replace with actual serial port data reading
    this.simulationInterval = setInterval(() => {
      if (this.connected) {
        this.simulateWeightReading();
      }
    }, 1000);
  }

  private simulateWeightReading(): void {
    // Generate realistic weight readings
    const baseWeight = 12.0;
    const variation = (Math.random() - 0.5) * 0.1; // ±0.05kg variation
    const weight = Math.round((baseWeight + variation) * 1000) / 1000;
    
    const reading: SerialReading = {
      weight,
      unit: 'kg',
      stable: Math.random() > 0.1, // 90% stable readings
      timestamp: new Date()
    };
    
    this.emit('data', reading);
  }

  async disconnect(): Promise<void> {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    this.connected = false;
    this.emit('disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  updateConfig(newConfig: any): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }
}

export const serialClient = new SerialClient({
  port: process.env.SERIAL_PORT || 'COM1',
  baudRate: parseInt(process.env.SERIAL_BAUD_RATE || '9600'),
  dataBits: parseInt(process.env.SERIAL_DATA_BITS || '8'),
  stopBits: parseInt(process.env.SERIAL_STOP_BITS || '1'),
  parity: process.env.SERIAL_PARITY || 'none'
});
