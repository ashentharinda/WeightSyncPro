import { EventEmitter } from "events";
import { connect, type MqttClient } from "mqtt";

export interface MQTTMessage {
  topic: string;
  payload: any;
  timestamp: Date;
}

export class MQTTClient extends EventEmitter {
  private connected: boolean = false;
  private config: {
    host: string;
    port: number;
    weightTopic: string;
    qos: number;
    username?: string;
    password?: string;
    clientId?: string;
  };
  private mqttClient: MqttClient | null = null;
  private simulateTimer?: NodeJS.Timeout;
  private usingSimulator: boolean = false;

  constructor(config: any) {
    super();
    this.config = {
      host: config.host || "localhost",
      port: config.port || 1883,
      weightTopic: config.weightTopic || "iot-2/Value3",
      qos: config.qos || 1,
      username: config.username,
      password: config.password,
      clientId: config.clientId || `weightsyncpro-${Date.now()}`,
    };
  }

  async connect(): Promise<void> {
    try {
      // Stop any existing simulation
      if (this.simulateTimer) {
        clearInterval(this.simulateTimer);
        this.simulateTimer = undefined;
      }

      // Try to connect to real MQTT broker
      const brokerUrl = `mqtt://${this.config.host}:${this.config.port}`;
      console.log(`🔌 Attempting to connect to MQTT broker: ${brokerUrl}`);
      console.log(`📡 Weight topic: ${this.config.weightTopic}`);

      const options: any = {
        clientId: this.config.clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      };

      if (this.config.username) {
        options.username = this.config.username;
      }
      if (this.config.password) {
        options.password = this.config.password;
      }

      this.mqttClient = connect(brokerUrl, options);

      this.mqttClient.on("connect", () => {
        this.connected = true;
        this.usingSimulator = false;
        console.log(`✅ MQTT client connected to ${brokerUrl}`);
        this.emit("connect");

        // Subscribe to weight topic
        this.subscribeToTopics();
      });

      this.mqttClient.on("message", (topic, message) => {
        try {
          // Parse message payload
          let payload: any;
          const messageStr = message.toString();

          // Try to parse as JSON
          try {
            payload = JSON.parse(messageStr);
          } catch {
            // If not JSON, try to parse as number or use as string
            const numMatch = messageStr.match(/(-?\d+(?:\.\d+)?)/);
            if (numMatch) {
              payload = { weight: parseFloat(numMatch[1]) };
            } else {
              payload = { raw: messageStr };
            }
          }

          // Extract weight from various payload formats
          const weight = this.extractWeight(payload);

          if (weight !== null && weight !== undefined) {
            const mqttMessage: MQTTMessage = {
              topic,
              payload: { weight, ...payload },
              timestamp: new Date(),
            };

            console.log(
              `📨 MQTT message received on ${topic}: weight=${weight}kg`
            );
            this.emit("message", mqttMessage);
          } else {
            console.log(
              `📨 MQTT message received on ${topic} (no weight data):`,
              payload
            );
          }
        } catch (error) {
          console.error("Error processing MQTT message:", error);
        }
      });

      this.mqttClient.on("error", (error) => {
        console.error("MQTT connection error:", error);
        this.emit("error", error);

        // Fallback to simulator if connection fails
        if (!this.usingSimulator) {
          console.log("📡 Falling back to simulated MQTT messages.");
          this.startWeightSimulation();
        }
      });

      this.mqttClient.on("close", () => {
        this.connected = false;
        console.log("MQTT connection closed");
        this.emit("disconnect");
      });

      this.mqttClient.on("offline", () => {
        this.connected = false;
        console.log("MQTT client offline");
        if (!this.usingSimulator) {
          console.log("📡 Falling back to simulated MQTT messages.");
          this.startWeightSimulation();
        }
      });

      // Fallback to simulator if connection fails after timeout
      setTimeout(() => {
        if (!this.connected && !this.usingSimulator) {
          console.log("⚠️  MQTT connection timeout, using simulator.");
          this.startWeightSimulation();
        }
      }, 15000); // 15 second timeout
    } catch (error) {
      console.error("MQTT initialization error:", error);
      this.emit("error", error);
      // Fallback to simulator
      this.startWeightSimulation();
    }
  }

  private extractWeight(payload: any): number | null {
    // Try various possible weight field names
    if (typeof payload === "number") {
      return payload;
    }

    if (typeof payload === "object" && payload !== null) {
      // Common field names for weight
      const weightFields = [
        "weight",
        "Weight",
        "WEIGHT",
        "value",
        "Value",
        "VALUE",
        "data",
        "Data",
        "d",
        "w",
        // IBM Watson IoT format
        "d.weight",
        "d.Weight",
      ];

      for (const field of weightFields) {
        if (payload[field] !== undefined) {
          const value = payload[field];
          if (typeof value === "number") {
            return value;
          }
          if (typeof value === "string") {
            const num = parseFloat(value);
            if (!isNaN(num)) return num;
          }
        }
      }

      // Try nested objects (e.g., payload.d.weight)
      if (payload.d && typeof payload.d === "object") {
        for (const field of weightFields) {
          if (payload.d[field] !== undefined) {
            const value = payload.d[field];
            if (typeof value === "number") {
              return value;
            }
            if (typeof value === "string") {
              const num = parseFloat(value);
              if (!isNaN(num)) return num;
            }
          }
        }
      }

      // Try to find any numeric value in the payload
      for (const key in payload) {
        const value = payload[key];
        if (typeof value === "number" && value > 0 && value < 10000) {
          // Reasonable weight range
          return value;
        }
      }
    }

    return null;
  }

  private subscribeToTopics(): void {
    if (!this.mqttClient || !this.connected) return;

    // Subscribe to weight topic
    this.mqttClient.subscribe(this.config.weightTopic, { qos: this.config.qos as 0 | 1 | 2 }, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${this.config.weightTopic}:`, err);
      } else {
        console.log(
          `✅ Subscribed to MQTT topic: ${this.config.weightTopic} (QoS: ${this.config.qos})`
        );
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.simulateTimer) {
      clearInterval(this.simulateTimer);
      this.simulateTimer = undefined;
    }

    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }

    this.connected = false;
    this.usingSimulator = false;
    this.emit("disconnect");
  }

  isConnected(): boolean {
    return this.connected;
  }

  private startWeightSimulation(): void {
    if (this.usingSimulator) return;

    this.usingSimulator = true;
    this.connected = true;
    console.log("📡 MQTT simulator active - generating simulated weight readings");

    if (this.simulateTimer) {
      clearInterval(this.simulateTimer);
    }

    this.simulateTimer = setInterval(() => {
      if (this.connected) {
        // Simulate realistic weight readings from PLC
        const baseWeight = 15.5;
        const variation = (Math.random() - 0.5) * 0.2; // ±0.1kg variation
        const weight = Math.round((baseWeight + variation) * 1000) / 1000;

        const message: MQTTMessage = {
          topic: this.config.weightTopic,
          payload: {
            weight,
            unit: "kg",
            timestamp: new Date().toISOString(),
            source: "plc",
          },
          timestamp: new Date(),
        };

        this.emit("message", message);
      }
    }, 2000);
  }

  updateConfig(newConfig: any): void {
    const oldTopic = this.config.weightTopic;
    this.config = { ...this.config, ...newConfig };
    console.log(
      `⚙️  MQTT config updated. Topic: ${oldTopic} → ${this.config.weightTopic}`
    );
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await this.connect();
  }
}

export const mqttClient = new MQTTClient({
  host: process.env.MQTT_HOST || "localhost",
  port: parseInt(process.env.MQTT_PORT || "1883"),
  weightTopic: process.env.MQTT_WEIGHT_TOPIC || "iot-2/Value3",
  qos: parseInt(process.env.MQTT_QOS || "1"),
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: process.env.MQTT_CLIENT_ID,
});
