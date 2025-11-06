import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import {
  insertTareConfigSchema,
  insertLorryQueueSchema,
  insertWeighmentSchema,
  insertSystemSettingsSchema,
  insertSystemActivitySchema,
  type WeightReading,
} from "@shared/schema";
import { mqttClient } from "./services/mqttClient";
import { serialClient } from "./services/serialClient";
import { apiClient } from "./services/apiClient";
import { weightValidator } from "./services/weightValidator";

export async function registerRoutes(
  app: Express,
  io: SocketIOServer | null
): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize hardware services only if Socket.IO is available
  if (io) {
    await initializeServices(io);
  }

  // API Routes

  // Tare Configuration Routes
  app.get("/api/tare-config/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const config = await storage.getTareConfigByDate(date);
      res.json(config || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tare configuration" });
    }
  });

  app.post("/api/tare-config", async (req, res) => {
    try {
      const validatedData = insertTareConfigSchema.parse(req.body);
      const config = await storage.createTareConfig(validatedData);

      // Log activity
      await storage.createActivity({
        type: "tare_config",
        message: `Daily tare configuration saved for ${config.date} (${config.tareWeight}kg)`,
        status: "success",
        metadata: { configId: config.id, date: config.date },
      });

      // Broadcast update
      io?.emit("tare_config_updated", {
        data: config,
        timestamp: new Date(),
      });

      res.status(201).json(config);
    } catch (error) {
      console.error("Tare config creation error:", error);
      res.status(400).json({ error: "Invalid tare configuration data" });
    }
  });

  // Lorry Queue Routes
  app.get("/api/lorry-queue", async (req, res) => {
    try {
      const queue = await storage.getLorryQueue();
      res.json(queue);
    } catch (error) {
      res.status(500).json({ error: "Failed to get lorry queue" });
    }
  });

  app.post("/api/lorry-queue", async (req, res) => {
    try {
      const validatedData = insertLorryQueueSchema.parse(req.body);
      const lorry = await storage.createLorry(validatedData);

      // Log activity
      await storage.createActivity({
        type: "lorry_added",
        message: `Lorry ${lorry.lorryNumber} added to queue (${lorry.line})`,
        status: "success",
        metadata: { lorryId: lorry.id },
      });

      // Broadcast update
      io?.emit("lorry_queue_updated", {
        data: await storage.getLorryQueue(),
        timestamp: new Date(),
      });

      res.status(201).json(lorry);
    } catch (error) {
      console.error("Lorry creation error:", error);
      res.status(400).json({ error: "Invalid lorry data" });
    }
  });

  app.patch("/api/lorry-queue/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, totalBags } = req.body;

      const updatedLorry = await storage.updateLorryStatus(
        id,
        status,
        totalBags
      );
      if (!updatedLorry) {
        return res.status(404).json({ error: "Lorry not found" });
      }

      // Log activity
      await storage.createActivity({
        type: "lorry_status_changed",
        message: `Lorry ${updatedLorry.lorryNumber} status changed to ${status}`,
        status: "success",
        metadata: { lorryId: id, newStatus: status },
      });

      // Broadcast update
      io?.emit("lorry_status_updated", {
        data: { lorryId: id, status, totalBags },
        timestamp: new Date(),
      });

      res.json(updatedLorry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update lorry status" });
    }
  });

  app.delete("/api/lorry-queue/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeLorryFromQueue(id);

      if (!success) {
        return res.status(404).json({ error: "Lorry not found" });
      }

      // Broadcast update
      io?.emit("lorry_removed", {
        data: { lorryId: id },
        timestamp: new Date(),
      });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove lorry" });
    }
  });

  // Weighment Routes
  app.get("/api/weighments/lorry/:lorryId", async (req, res) => {
    try {
      const { lorryId } = req.params;
      const weighments = await storage.getWeighmentsByLorryId(lorryId);
      res.json(weighments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get weighments" });
    }
  });

  app.get("/api/weighments/today", async (req, res) => {
    try {
      const weighments = await storage.getTodaysWeighments();
      res.json(weighments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get today's weighments" });
    }
  });

  app.post("/api/weighments", async (req, res) => {
    try {
      const validatedData = insertWeighmentSchema.parse(req.body);
      const weighment = await storage.createWeighment(validatedData);

      // Sync with external API
      const lorry = await storage.getLorryById(weighment.lorryId);
      if (lorry) {
        try {
          await apiClient.syncWeighment({
            tagId: weighment.tagId,
            weight: weighment.finalWeight,
            tareWeight: weighment.tareWeight,
            netWeight: weighment.netWeight,
            lorryNumber: lorry.lorryNumber,
            timestamp: weighment.createdAt || new Date(),
          });
        } catch (syncError) {
          console.error("API sync failed:", syncError);
          // Continue processing even if sync fails
        }
      }

      // Log activity
      await storage.createActivity({
        type: "weighment",
        message: `Weighment saved: ${weighment.tagId} (${weighment.netWeight}kg net)`,
        status: weighment.toleranceStatus === "good" ? "success" : "warning",
        metadata: {
          weighmentId: weighment.id,
          toleranceStatus: weighment.toleranceStatus,
          weightDifference: weighment.weightDifference,
        },
      });

      // Broadcast update
      io?.emit("weighment_created", {
        data: weighment,
        timestamp: new Date(),
      });

      res.status(201).json(weighment);
    } catch (error) {
      console.error("Weighment creation error:", error);
      res.status(400).json({ error: "Invalid weighment data" });
    }
  });

  // Stats Routes
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getWeighmentStats();
      const queue = await storage.getLorryQueue();
      const activeLorries = queue.filter((l) => l.status === "active").length;

      res.json({
        ...stats,
        activeLorries,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // System Settings Routes
  app.get("/api/settings/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const settings = await storage.getSettingsByCategory(category);
      res.json(settings?.settings || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.post("/api/settings/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const settings = await storage.upsertSettings(category, req.body);

      // Update service configurations
      updateServiceConfigurations(category, req.body);

      // Auto-reconnect services on live config change
      try {
        if (category === "mqtt") {
          // soft reconnect MQTT
          await mqttClient.reconnect?.();
        }
        if (category === "serial") {
          // soft reconnect Serial with updated config
          await serialClient.disconnect();
          // Ensure we wait a bit before reconnecting
          await new Promise((resolve) => setTimeout(resolve, 100));
          await serialClient.connect();
        }
      } catch (e) {
        console.error("Live reconfigure failed:", e);
      }

      // Return just the settings object to match GET endpoint format
      res.json(settings.settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // System Activities Routes
  app.get("/api/activities", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to get activities" });
    }
  });

  // Weight Reading Endpoint (for current readings)
  app.get("/api/weight-reading", async (req, res) => {
    try {
      // Return the current weight readings from both sources
      const reading = getCurrentWeightReading();
      res.json(reading);
    } catch (error) {
      res.status(500).json({ error: "Failed to get weight reading" });
    }
  });

  // Test API Connection
  app.post("/api/test-connection", async (req, res) => {
    try {
      const result = await apiClient.testConnection();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Connection test failed" });
    }
  });

  return httpServer;
}

// Export function to initialize services after Socket.IO is created
export async function initializeServicesWithSocketIO(io: SocketIOServer) {
  await initializeServices(io);
}

let currentWeightReading: WeightReading = {
  plcWeight: undefined,
  serialWeight: undefined,
  timestamp: new Date(),
};

function getCurrentWeightReading(): WeightReading {
  return { ...currentWeightReading };
}

async function initializeServices(io: SocketIOServer) {
  // Initialize MQTT client
  mqttClient.on("connect", () => {
    console.log("MQTT client connected");
    io.emit("mqtt_status", {
      data: { connected: true },
      timestamp: new Date(),
    });
  });

  mqttClient.on("message", (message) => {
    // Extract weight from message payload (handles various formats)
    const weight =
      message.payload?.weight ||
      message.payload?.value ||
      message.payload?.data;

    if (weight !== null && weight !== undefined) {
      currentWeightReading.plcWeight = weight;
      currentWeightReading.timestamp = new Date();

      io.emit("weight_update", {
        data: { source: "plc", weight: weight },
        timestamp: new Date(),
      });
    } else {
      // Log if we received a message but couldn't extract weight
      console.log(
        `MQTT message on ${message.topic} but no weight data found:`,
        message.payload
      );
    }
  });

  mqttClient.on("error", (error) => {
    console.error("MQTT error:", error);
    io.emit("mqtt_status", {
      data: { connected: false, error: error.message },
      timestamp: new Date(),
    });
  });

  // Initialize Serial client
  serialClient.on("connect", () => {
    console.log("Serial client connected");
    io.emit("serial_status", {
      data: { connected: true },
      timestamp: new Date(),
    });
  });

  serialClient.on("data", (reading) => {
    // Update current reading regardless of stability
    currentWeightReading.serialWeight = reading.weight;
    currentWeightReading.timestamp = new Date();

    // Emit all readings, not just stable ones (frontend can filter if needed)
    io.emit("weight_update", {
      data: {
        source: "serial",
        weight: reading.weight,
        stable: reading.stable,
      },
      timestamp: new Date(),
    });
  });

  serialClient.on("error", (error) => {
    console.error("Serial error:", error);
    io.emit("serial_status", {
      data: { connected: false, error: error.message },
      timestamp: new Date(),
    });
  });

  // Initialize API client
  apiClient.on("connect", () => {
    io.emit("api_status", {
      data: { connected: true },
      timestamp: new Date(),
    });
  });

  apiClient.on("sync_success", (event) => {
    io.emit("api_sync", {
      data: { success: true, data: event.data },
      timestamp: new Date(),
    });
  });

  // Load settings from storage and apply to services before connecting
  try {
    const mqttSettings = await storage.getSettingsByCategory("mqtt");
    if (mqttSettings?.settings) {
      mqttClient.updateConfig(mqttSettings.settings);
      console.log("📋 Loaded MQTT settings from storage");
    }

    const serialSettings = await storage.getSettingsByCategory("serial");
    if (serialSettings?.settings) {
      serialClient.updateConfig(serialSettings.settings);
      console.log("📋 Loaded Serial settings from storage");
    }

    const apiSettings = await storage.getSettingsByCategory("api");
    if (apiSettings?.settings) {
      apiClient.updateConfig(apiSettings.settings);
      console.log("📋 Loaded API settings from storage");
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }

  // Connect services
  try {
    await mqttClient.connect();
    await serialClient.connect();
    await apiClient.testConnection();
    apiClient.startAutoSync();
  } catch (error) {
    console.error("Service initialization error:", error);
  }
}

function updateServiceConfigurations(category: string, settings: any) {
  switch (category) {
    case "mqtt":
      mqttClient.updateConfig(settings);
      break;
    case "serial":
      serialClient.updateConfig(settings);
      break;
    case "api":
      apiClient.updateConfig(settings);
      break;
    case "tolerance":
      weightValidator.updateConfig(settings);
      break;
  }
}
