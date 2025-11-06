// index.ts — CORRECTED VERSION

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, initializeServicesWithSocketIO } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { mongoService } from './services/mongoService'; // ← Fix path if needed
import { mqttClient } from './services/mqttClient';     // ← Fix path if needed
import weightRoutes from './routes/weightRoutes';        // ← Fix path if needed
import { Server as SocketIOServer } from 'socket.io';

//  DECLARE APP FIRST
const app = express();

//  MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('client/dist'));

//  CUSTOM LOGGING MIDDLEWARE (your original code)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

//  ROUTES
app.use('/api/weights', weightRoutes);

//  ERROR HANDLER (MUST BE BEFORE CATCH-ALL VITE ROUTE)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err;
});

//  ASYNC BOOTSTRAP
(async () => {
  try {
    //  START HTTP SERVER FIRST
    const PORT = parseInt(process.env.PORT || '5000', 10);
    const server = await registerRoutes(app, null as any); // Will be updated with Socket.IO

    // Setup Vite or static serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Handle server errors (e.g., port already in use)
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please:`);
        console.error(`   1. Stop the process using port ${PORT}`);
        console.error(`   2. Or change the PORT environment variable`);
        console.error(`\n   To find and kill the process:`);
        console.error(`   Windows: netstat -ano | findstr :${PORT}`);
        console.error(`   Then: taskkill /PID <PID> /F`);
      } else {
        console.error('❌ Server error:', err);
      }
      process.exit(1);
    });

    server.listen(PORT, '0.0.0.0', async () => {
      console.log(`🚀 Server running at http://localhost:${PORT}/`);

      //  CONNECT TO MONGODB
      await mongoService.connect();

      //  SETUP WEBSOCKET AFTER SERVER IS CREATED
      const io = new SocketIOServer(server, {
        cors: { origin: "*" }
      });

      // Initialize services with Socket.IO
      await initializeServicesWithSocketIO(io);

      // MQTT and Serial data handling is now managed in routes.ts via initializeServicesWithSocketIO

      // ✅ GRACEFUL SHUTDOWN
      process.on('SIGINT', async () => {
        console.log('🛑 Shutting down...');
        await mongoService.close();
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
})();