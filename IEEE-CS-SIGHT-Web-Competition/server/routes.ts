import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { contactFormSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  app.get("/api/execom", async (_req, res) => {
    res.json(await storage.getExecomMembers());
  });

  app.get("/api/activities", async (_req, res) => {
    res.json(await storage.getActivities());
  });

  app.get("/api/achievements", async (_req, res) => {
    res.json(await storage.getAchievements());
  });

  app.post("/api/contact", async (req, res, next) => {
    try {
      const parsed = contactFormSchema.parse(req.body);
      await storage.submitContactForm(parsed);
      res.status(202).json({ message: "Received" });
    } catch (err) {
      next(err);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
