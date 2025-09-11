import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameResultSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Save game result
  app.post("/api/game-results", async (req, res) => {
    try {
      const validatedData = insertGameResultSchema.parse(req.body);
      const result = await storage.saveGameResult(validatedData);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: "Invalid game result data" });
    }
  });

  // Get best times leaderboard
  app.get("/api/game-results/best", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const bestTimes = await storage.getBestTimes(limit);
      res.json(bestTimes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch best times" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
