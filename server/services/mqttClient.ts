import { EventEmitter } from 'events';

// Mock MQTT client for demonstration - replace with actual mqtt library
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
  };
  private simulateTimer?: NodeJS.Timeout;

  constructor(config: any) {
    super();
    this.config = {
      host: config.host || 'test.mosquitto.org',
      port: config.port || 1883,
      weightTopic: config.weightTopic || 'iot-2/Value3',
      qos: config.qos || 1
    };
  }

  async connect(): Promise<void> {
    try {
      // Simulate connection - replace with actual MQTT connection
      this.connected = true;
      this.emit('connect');
      
      // Start listening to topics
      this.subscribeToTopics();
      
      // Start simulating PLC weight data
      this.startWeightSimulation();
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private subscribeToTopics(): void {
    // Subscribe to weight topic
    this.subscribe(this.config.weightTopic);
  }

  private subscribe(topic: string): void {
    // Simulate subscription - replace with actual MQTT subscription
    console.log(`Subscribed to MQTT topic: ${topic}`);
  }

  async disconnect(): Promise<void> {
    if (this.simulateTimer) {
      clearInterval(this.simulateTimer);
      this.simulateTimer = undefined;
    }
    this.connected = false;
    this.emit('disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Simulate receiving messages - replace with actual MQTT message handling
  simulateWeightMessage(weight: number): void {
    if (!this.connected) return;
    
    const message: MQTTMessage = {
      topic: this.config.weightTopic,
      payload: { weight, unit: 'kg' },
      timestamp: new Date()
    };
    
    this.emit('message', message);
  }


  private startWeightSimulation(): void {
    // Simulate PLC weight data every 2 seconds
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
            weight, unit: 'kg',
            timestamp: new Date().toISOString(),
            source: 'plc'
          },
          timestamp: new Date()
        };
        
        this.emit('message', message);
      }
    }, 2000);
  }

  updateConfig(newConfig: any): void {
    this.config = { ...this.config, ...newConfig };
  }

  async reconnect(): Promise<void> {
    if (this.connected) await this.disconnect();
    await this.connect();
  }
}

export const mqttClient = new MQTTClient({
  host: 'test.mosquitto.org',
  port: 1883,
  weightTopic: 'iot-2/Value3'
});
