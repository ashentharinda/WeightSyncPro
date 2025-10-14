import { 
  type User, 
  type InsertUser,
  type TareConfiguration,
  type InsertTareConfiguration,
  type LorryQueue,
  type InsertLorryQueue,
  type Weighment,
  type InsertWeighment,
  type SystemSettings,
  type InsertSystemSettings,
  type SystemActivity,
  type InsertSystemActivity,
  type LorryWithTareConfig,
  type WeighmentWithLorry
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Tare Configurations
  getTareConfigByDate(date: string): Promise<TareConfiguration | undefined>;
  createTareConfig(config: InsertTareConfiguration): Promise<TareConfiguration>;
  updateTareConfig(id: string, config: Partial<InsertTareConfiguration>): Promise<TareConfiguration | undefined>;

  // Lorry Queue
  getLorryQueue(): Promise<LorryWithTareConfig[]>;
  getLorryById(id: string): Promise<LorryWithTareConfig | undefined>;
  createLorry(lorry: InsertLorryQueue): Promise<LorryQueue>;
  updateLorryStatus(id: string, status: string, totalBags?: number): Promise<LorryQueue | undefined>;
  removeLorryFromQueue(id: string): Promise<boolean>;

  // Weighments
  getWeighmentsByLorryId(lorryId: string): Promise<Weighment[]>;
  getTodaysWeighments(): Promise<WeighmentWithLorry[]>;
  createWeighment(weighment: InsertWeighment): Promise<Weighment>;
  getWeighmentStats(): Promise<{
    totalWeighments: number;
    toleranceViolations: number;
    avgWeight: number;
  }>;

  // System Settings
  getSettingsByCategory(category: string): Promise<SystemSettings | undefined>;
  upsertSettings(category: string, settings: any): Promise<SystemSettings>;

  // System Activities
  getRecentActivities(limit?: number): Promise<SystemActivity[]>;
  createActivity(activity: InsertSystemActivity): Promise<SystemActivity>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private tareConfigs: Map<string, TareConfiguration>;
  private lorryQueue: Map<string, LorryQueue>;
  private weighments: Map<string, Weighment>;
  private systemSettings: Map<string, SystemSettings>;
  private systemActivities: Map<string, SystemActivity>;

  constructor() {
    this.users = new Map();
    this.tareConfigs = new Map();
    this.lorryQueue = new Map();
    this.weighments = new Map();
    this.systemSettings = new Map();
    this.systemActivities = new Map();
    this.loadSettingsFromDisk();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Tare Configurations
  async getTareConfigByDate(date: string): Promise<TareConfiguration | undefined> {
    return Array.from(this.tareConfigs.values()).find(
      (config) => config.date === date
    );
  }

  async createTareConfig(config: InsertTareConfiguration): Promise<TareConfiguration> {
    const id = randomUUID();
    const tareConfig: TareConfiguration = { 
      ...config, 
      id, 
      createdAt: new Date() 
    };
    this.tareConfigs.set(id, tareConfig);
    return tareConfig;
  }

  async updateTareConfig(id: string, config: Partial<InsertTareConfiguration>): Promise<TareConfiguration | undefined> {
    const existing = this.tareConfigs.get(id);
    if (!existing) return undefined;
    
    const updated: TareConfiguration = { ...existing, ...config };
    this.tareConfigs.set(id, updated);
    return updated;
  }

  // Lorry Queue
  async getLorryQueue(): Promise<LorryWithTareConfig[]> {
    const lorries = Array.from(this.lorryQueue.values())
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
    
    return lorries.map(lorry => {
      const tareConfig = lorry.tareConfigId 
        ? this.tareConfigs.get(lorry.tareConfigId) 
        : undefined;
      
      const weighmentCount = Array.from(this.weighments.values())
        .filter(w => w.lorryId === lorry.id).length;

      return {
        ...lorry,
        tareConfig,
        weighmentCount
      };
    });
  }

  async getLorryById(id: string): Promise<LorryWithTareConfig | undefined> {
    const lorry = this.lorryQueue.get(id);
    if (!lorry) return undefined;

    const tareConfig = lorry.tareConfigId 
      ? this.tareConfigs.get(lorry.tareConfigId) 
      : undefined;
    
    const weighmentCount = Array.from(this.weighments.values())
      .filter(w => w.lorryId === lorry.id).length;

    return {
      ...lorry,
      tareConfig,
      weighmentCount
    };
  }

  async createLorry(lorry: InsertLorryQueue): Promise<LorryQueue> {
    const id = randomUUID();
    const newLorry: LorryQueue = { 
      ...lorry, 
      id, 
      status: lorry.status || "waiting",
      createdAt: new Date() 
    };
    this.lorryQueue.set(id, newLorry);
    return newLorry;
  }

  async updateLorryStatus(id: string, status: string, totalBags?: number): Promise<LorryQueue | undefined> {
    const existing = this.lorryQueue.get(id);
    if (!existing) return undefined;
    
    const updated: LorryQueue = { 
      ...existing, 
      status,
      ...(totalBags !== undefined && { totalBags })
    };
    this.lorryQueue.set(id, updated);
    return updated;
  }

  async removeLorryFromQueue(id: string): Promise<boolean> {
    return this.lorryQueue.delete(id);
  }

  // Weighments
  async getWeighmentsByLorryId(lorryId: string): Promise<Weighment[]> {
    return Array.from(this.weighments.values())
      .filter(w => w.lorryId === lorryId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getTodaysWeighments(): Promise<WeighmentWithLorry[]> {
    const today = new Date().toISOString().split('T')[0];
    const todaysWeighments = Array.from(this.weighments.values())
      .filter(w => w.createdAt?.toISOString().startsWith(today))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    return todaysWeighments.map(weighment => ({
      ...weighment,
      lorry: this.lorryQueue.get(weighment.lorryId)!
    }));
  }

  async createWeighment(weighment: InsertWeighment): Promise<Weighment> {
    const id = randomUUID();
    const newWeighment: Weighment = { 
      ...weighment, 
      id, 
      plcWeight: weighment.plcWeight ?? null,
      serialWeight: weighment.serialWeight ?? null,
      weightDifference: weighment.weightDifference ?? null,
      createdAt: new Date() 
    };
    this.weighments.set(id, newWeighment);
    return newWeighment;
  }

  async getWeighmentStats(): Promise<{
    totalWeighments: number;
    toleranceViolations: number;
    avgWeight: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const todaysWeighments = Array.from(this.weighments.values())
      .filter(w => w.createdAt?.toISOString().startsWith(today));

    const totalWeighments = todaysWeighments.length;
    const toleranceViolations = todaysWeighments
      .filter(w => w.toleranceStatus !== "good").length;
    
    const avgWeight = totalWeighments > 0 
      ? todaysWeighments.reduce((sum, w) => sum + w.netWeight, 0) / totalWeighments
      : 0;

    return {
      totalWeighments,
      toleranceViolations,
      avgWeight: Math.round(avgWeight * 100) / 100
    };
  }

  // System Settings
  async getSettingsByCategory(category: string): Promise<SystemSettings | undefined> {
    return Array.from(this.systemSettings.values()).find(
      (setting) => setting.category === category
    );
  }

  async upsertSettings(category: string, settings: any): Promise<SystemSettings> {
    const existing = Array.from(this.systemSettings.values()).find(
      (setting) => setting.category === category
    );

    if (existing) {
      const updated: SystemSettings = {
        ...existing,
        settings,
        updatedAt: new Date()
      };
      this.systemSettings.set(existing.id, updated);
      await this.saveSettingsToDisk();
      return updated;
    } else {
      const id = randomUUID();
      const newSettings: SystemSettings = {
        id,
        category,
        settings,
        updatedAt: new Date()
      };
      this.systemSettings.set(id, newSettings);
      await this.saveSettingsToDisk();
      return newSettings;
    }
  }

  // System Activities
  async getRecentActivities(limit: number = 50): Promise<SystemActivity[]> {
    return Array.from(this.systemActivities.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async createActivity(activity: InsertSystemActivity): Promise<SystemActivity> {
    const id = randomUUID();
    const newActivity: SystemActivity = { 
      ...activity, 
      id, 
      metadata: activity.metadata ?? null,
      createdAt: new Date() 
    };
    this.systemActivities.set(id, newActivity);
    return newActivity;
  }

  private settingsFilePath(): string {
    return process.env.SETTINGS_PATH || './.data/settings.json';
  }

  private async loadSettingsFromDisk(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = this.settingsFilePath();
      if (!fs.existsSync(path)) return;
      const raw = await fs.promises.readFile(path, 'utf-8');
      const arr: SystemSettings[] = JSON.parse(raw);
      for (const s of arr) {
        this.systemSettings.set(s.id, { ...s, updatedAt: new Date(s.updatedAt as any) });
      }
    } catch {}
  }

  private async saveSettingsToDisk(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = this.settingsFilePath();
      const dir = path.split('/').slice(0, -1).join('/');
      if (dir && !fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const out = JSON.stringify(Array.from(this.systemSettings.values()), null, 2);
      await fs.promises.writeFile(path, out, 'utf-8');
    } catch (e) {
      console.error('Failed to persist settings:', e);
    }
  }
}

export const storage = new MemStorage();
