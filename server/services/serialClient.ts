import { EventEmitter } from 'events';

export interface SerialReading {
  weight: number;
  unit: string;
  stable: boolean;
  timestamp: Date;
}

type SerialConfig = {
  port: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  lineTerminator?: string; // Optional override for line parsing (e.g. "\r\n")
};

export class SerialClient extends EventEmitter {
  private connected: boolean = false;
  private config: SerialConfig;
  private simulationInterval?: NodeJS.Timeout;
  private serialPortInstance: any | null = null;
  private usingSimulator: boolean = true;

  constructor(config: Partial<SerialConfig>) {
    super();
    this.config = {
      port: config.port || 'COM3',
      baudRate: config.baudRate || 9600,
      dataBits: config.dataBits || 8,
      stopBits: config.stopBits || 1,
      parity: config.parity || 'none',
      lineTerminator: config.lineTerminator || undefined
    };
  }

  async connect(): Promise<void> {
    try {
      // Attempt to load real serialport deps
      const SerialPortMod = await this.safeImport('serialport');
      const ParserMod = await this.safeImport('@serialport/parser-readline');

      if (SerialPortMod && ParserMod) {
        const SerialPort = (SerialPortMod as any).SerialPort || (SerialPortMod as any);
        const ReadlineParser = (ParserMod as any).ReadlineParser || (ParserMod as any);

        // If list() exists, show available ports for easier diagnostics
        try {
          if (typeof SerialPort.list === 'function') {
            const ports = await SerialPort.list();
            console.log('Available serial ports:', ports.map((p: any) => `${p.path}${p.friendlyName ? ` - ${p.friendlyName}` : ''}`));
          }
        } catch {}

        this.serialPortInstance = new SerialPort({
          path: this.config.port,
          baudRate: this.config.baudRate,
          dataBits: this.config.dataBits,
          stopBits: this.config.stopBits,
          parity: this.config.parity
        });

        const parser = this.serialPortInstance.pipe(new ReadlineParser({
          delimiter: this.config.lineTerminator || '\\r\\n'
        }));

        this.serialPortInstance.on('open', () => {
          this.usingSimulator = false;
          this.connected = true;
          this.emit('connect');
          console.log(`Serial port opened on ${this.config.port} @ ${this.config.baudRate}`);
        });

        parser.on('data', (line: string) => {
          const reading = this.parseLine(line);
          if (reading) {
            this.emit('data', reading);
          }
        });

        this.serialPortInstance.on('error', (err: Error) => {
          console.error('Serial port error:', err);
          this.emit('error', err);
          // Fallback to simulator if open fails or device is missing
          const msg = String((err as any)?.message || '').toLowerCase();
          if (msg.includes('cannot') || msg.includes('file not found') || msg.includes('no such file') || msg.includes('busy') || msg.includes('open')) {
            if (!this.usingSimulator) {
              console.log('Falling back to simulated serial readings.');
              this.startSimulator();
            }
          }
        });

        this.serialPortInstance.on('close', () => {
          this.connected = false;
          this.emit('disconnect');
        });

        return; // Real port path returns here
      }

      // Fallback to simulator if serialport not available
      this.startSimulator();
    } catch (error) {
      // Any unexpected error → simulator fallback
      console.error('Serial init failed, using simulator:', error);
      this.startSimulator();
    }
  }

  private async safeImport(id: string): Promise<any | null> {
    try {
      return await import(id);
    } catch {
      return null;
    }
  }

  private startSimulator(): void {
    this.usingSimulator = true;
    this.connected = true;
    this.emit('connect');
    this.simulationInterval = setInterval(() => {
      if (this.connected) this.simulateWeightReading();
    }, 1000);
  }

  private parseLine(line: string): SerialReading | null {
    // Common scale outputs can be like: "ST,GS,  12.345 kg" or "12.345kg" or "W:12.345,ST"
    const trimmed = String(line).trim();
    if (!trimmed) return null;

    const numberMatch = trimmed.match(/(-?\d+(?:[\.,]\d+)?)/);
    if (!numberMatch) return null;

    const raw = numberMatch[1].replace(',', '.');
    const weight = parseFloat(raw);
    if (Number.isNaN(weight)) return null;

    const stable = /ST|OK|stable|\bS\b/i.test(trimmed) ? true : /US|unstable|\bU\b/i.test(trimmed) ? false : true;
    const unit = /kg/i.test(trimmed) ? 'kg' : /g\b/i.test(trimmed) ? 'g' : 'kg';

    const valueKg = unit === 'g' ? weight / 1000 : weight;

    return {
      weight: Math.round(valueKg * 1000) / 1000,
      unit: 'kg',
      stable,
      timestamp: new Date()
    };
  }

  private simulateWeightReading(): void {
    const baseWeight = 12.0;
    const variation = (Math.random() - 0.5) * 0.1;
    const weight = Math.round((baseWeight + variation) * 1000) / 1000;
    const reading: SerialReading = {
      weight,
      unit: 'kg',
      stable: Math.random() > 0.1,
      timestamp: new Date()
    };
    console.log(`Serial weight reading: ${weight}kg (stable: ${reading.stable})`);
    this.emit('data', reading);
  }

  async disconnect(): Promise<void> {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = undefined;
    }
    if (this.serialPortInstance && !this.usingSimulator) {
      try {
        await new Promise<void>((resolve) => {
          this.serialPortInstance.close(() => resolve());
        });
      } catch {}
      this.serialPortInstance = null;
    }
    this.connected = false;
    this.emit('disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  updateConfig(newConfig: Partial<SerialConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }
}

export const serialClient = new SerialClient({
  port: process.env.SERIAL_PORT || 'COM3',
  baudRate: parseInt(process.env.SERIAL_BAUD_RATE || '9600'),
  dataBits: parseInt(process.env.SERIAL_DATA_BITS || '8'),
  stopBits: parseInt(process.env.SERIAL_STOP_BITS || '1'),
  parity: process.env.SERIAL_PARITY || 'none'
});
