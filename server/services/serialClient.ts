import { EventEmitter } from "events";

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
      port: config.port || "COM3",
      baudRate: config.baudRate || 9600,
      dataBits: config.dataBits || 8,
      stopBits: config.stopBits || 1,
      parity: config.parity || "none",
      lineTerminator: config.lineTerminator || undefined,
    };
  }

  async connect(): Promise<void> {
    // Ensure we're disconnected before connecting
    if (this.connected) {
      await this.disconnect();
      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(
      `🔌 Attempting to connect to serial port: ${this.config.port} @ ${this.config.baudRate}`
    );

    try {
      // Attempt to load real serialport deps
      const SerialPortMod = await this.safeImport("serialport");
      const ParserMod = await this.safeImport("@serialport/parser-readline");

      if (SerialPortMod && ParserMod) {
        const SerialPort =
          (SerialPortMod as any).SerialPort || (SerialPortMod as any);
        const ReadlineParser =
          (ParserMod as any).ReadlineParser || (ParserMod as any);

        // Check available ports first
        let availablePorts: any[] = [];
        let portExists = false;

        try {
          if (typeof SerialPort.list === "function") {
            availablePorts = await SerialPort.list();
            const portNames = availablePorts.map((p: any) => p.path);
            portExists = portNames.includes(this.config.port);

            if (availablePorts.length > 0) {
              console.log(
                "Available serial ports:",
                availablePorts.map(
                  (p: any) =>
                    `${p.path}${p.friendlyName ? ` - ${p.friendlyName}` : ""}`
                )
              );
            } else {
              console.log("No serial ports detected.");
            }
          }
        } catch (listError) {
          // If we can't list ports, we'll try to open anyway
          console.log(
            "Could not list serial ports, attempting to open configured port..."
          );
        }

        // Only attempt to open if port exists, or if we couldn't check (fallback behavior)
        if (!portExists && availablePorts.length > 0) {
          console.log(
            `⚠️  Serial port ${this.config.port} not found. Available ports: ${
              availablePorts.map((p: any) => p.path).join(", ") || "none"
            }`
          );
          console.log("📡 Using simulated serial readings instead.");
          this.startSimulator();
          return;
        }

        // Set up error handlers before creating the port instance
        let errorHandlerSetup = false;
        const setupErrorHandlers = () => {
          if (errorHandlerSetup) return;
          errorHandlerSetup = true;

          this.serialPortInstance.on("error", (err: Error) => {
            const msg = String((err as any)?.message || "").toLowerCase();
            const isPortNotFound =
              msg.includes("cannot") ||
              msg.includes("file not found") ||
              msg.includes("no such file") ||
              msg.includes("eacces") ||
              msg.includes("enoent");

            if (isPortNotFound && !this.usingSimulator) {
              console.log(
                `⚠️  Serial port ${this.config.port} unavailable: ${err.message}`
              );
              console.log("📡 Falling back to simulated serial readings.");
              this.startSimulator();
            } else if (!isPortNotFound) {
              // Only log non-port-not-found errors
              console.error("Serial port error:", err);
              this.emit("error", err);
            }
          });

          this.serialPortInstance.on("close", () => {
            if (!this.usingSimulator) {
              this.connected = false;
              this.emit("disconnect");
            }
          });
        };

        try {
          this.serialPortInstance = new SerialPort({
            path: this.config.port,
            baudRate: this.config.baudRate,
            dataBits: this.config.dataBits,
            stopBits: this.config.stopBits,
            parity: this.config.parity,
          });

          setupErrorHandlers();

          const parser = this.serialPortInstance.pipe(
            new ReadlineParser({
              delimiter: this.config.lineTerminator || "\\r\\n",
            })
          );

          this.serialPortInstance.on("open", () => {
            this.usingSimulator = false;
            this.connected = true;
            this.emit("connect");
            console.log(
              `✅ Serial port opened on ${this.config.port} @ ${this.config.baudRate}`
            );
          });

          parser.on("data", (line: string) => {
            const reading = this.parseLine(line);
            if (reading) {
              this.emit("data", reading);
            }
          });

          // If port fails to open synchronously, error handler will catch it
          // Give it a moment to see if it opens or errors
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 1000);
            if (this.serialPortInstance) {
              this.serialPortInstance.once("open", () => {
                clearTimeout(timeout);
                resolve();
              });
              this.serialPortInstance.once("error", () => {
                clearTimeout(timeout);
                resolve();
              });
            } else {
              clearTimeout(timeout);
              resolve();
            }
          });

          return; // Real port path returns here
        } catch (error: any) {
          // If constructor throws synchronously, fall back to simulator
          const msg = String(error?.message || "").toLowerCase();
          if (
            msg.includes("cannot") ||
            msg.includes("file not found") ||
            msg.includes("no such file")
          ) {
            console.log(
              `⚠️  Serial port ${this.config.port} not available: ${error.message}`
            );
            console.log("📡 Using simulated serial readings instead.");
            this.startSimulator();
            return;
          }
          throw error; // Re-throw if it's a different error
        }
      }

      // Fallback to simulator if serialport not available
      this.startSimulator();
    } catch (error) {
      // Any unexpected error → simulator fallback
      console.log(
        "📡 Serial init failed, using simulator:",
        (error as Error).message
      );
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
    if (this.usingSimulator) return; // Already using simulator

    this.usingSimulator = true;
    this.connected = true;
    console.log(
      "📡 Serial port simulator active - generating simulated weight readings"
    );
    this.emit("connect");
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

    const raw = numberMatch[1].replace(",", ".");
    const weight = parseFloat(raw);
    if (Number.isNaN(weight)) return null;

    const stable = /ST|OK|stable|\bS\b/i.test(trimmed)
      ? true
      : /US|unstable|\bU\b/i.test(trimmed)
      ? false
      : true;
    const unit = /kg/i.test(trimmed) ? "kg" : /g\b/i.test(trimmed) ? "g" : "kg";

    const valueKg = unit === "g" ? weight / 1000 : weight;

    return {
      weight: Math.round(valueKg * 1000) / 1000,
      unit: "kg",
      stable,
      timestamp: new Date(),
    };
  }

  private simulateWeightReading(): void {
    const baseWeight = 12.0;
    const variation = (Math.random() - 0.5) * 0.1;
    const weight = Math.round((baseWeight + variation) * 1000) / 1000;
    const reading: SerialReading = {
      weight,
      unit: "kg",
      stable: Math.random() > 0.1,
      timestamp: new Date(),
    };
    console.log(
      `Serial weight reading: ${weight}kg (stable: ${reading.stable})`
    );
    this.emit("data", reading);
  }

  async disconnect(): Promise<void> {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = undefined;
    }
    if (this.serialPortInstance && !this.usingSimulator) {
      try {
        await new Promise<void>((resolve) => {
          if (this.serialPortInstance) {
            this.serialPortInstance.close(() => resolve());
          } else {
            resolve();
          }
        });
      } catch {}
      this.serialPortInstance = null;
    }
    this.connected = false;
    this.usingSimulator = false; // Reset simulator flag
    this.emit("disconnect");
  }

  isConnected(): boolean {
    return this.connected;
  }

  updateConfig(newConfig: Partial<SerialConfig>): void {
    const oldPort = this.config.port;
    this.config = { ...this.config, ...newConfig };
    console.log(
      `⚙️  Serial config updated. Port: ${oldPort} → ${this.config.port}`
    );
  }

  getConfig() {
    return { ...this.config };
  }
}

export const serialClient = new SerialClient({
  port: process.env.SERIAL_PORT || "COM3",
  baudRate: parseInt(process.env.SERIAL_BAUD_RATE || "9600"),
  dataBits: parseInt(process.env.SERIAL_DATA_BITS || "8"),
  stopBits: parseInt(process.env.SERIAL_STOP_BITS || "1"),
  parity: process.env.SERIAL_PARITY || "none",
});
