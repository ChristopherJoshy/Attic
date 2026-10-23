import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

import { 
  insertProjectSchema,
  insertSkillSchema,
  insertCertificateSchema,
  insertSocialLinkSchema,
  insertMessageSchema,
  insertBioSchema,
  insertGithubStatsSchema,
  insertAsciiArtSchema
} from "@shared/schema";

export function registerRoutes(app: Express): Server {
  // Admin password middleware
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "passwordissoory";
  let adminSession: { authenticated: boolean; timestamp: number } = { authenticated: false, timestamp: 0 };

  app.post("/api/admin/auth", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      adminSession = { authenticated: true, timestamp: Date.now() };
      res.json({ success: true, message: "Admin mode enabled" });
    } else {
      res.status(401).json({ success: false, message: "Invalid password" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    adminSession = { authenticated: false, timestamp: 0 };
    res.json({ success: true, message: "Logged out" });
  });

  const requireAdmin = (req: any, res: any, next: any) => {
    // Check if session is valid (within 1 hour)
    const isValidSession = adminSession.authenticated && 
      (Date.now() - adminSession.timestamp < 3600000);
    
    if (!isValidSession) {
      adminSession = { authenticated: false, timestamp: 0 };
      return res.status(401).json({ success: false, message: "Admin authentication required" });
    }
    next();
  };

  // Health check with Firebase connection test
  app.get("/api/health", async (_req, res) => {
    try {
      // Test Firebase connection by attempting to read from a collection
      await storage.getProjects();
      res.json({ 
        status: "ok", 
        firebase: "connected",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({ 
        status: "error", 
        firebase: "disconnected",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error: any) {
      console.error('Project validation error:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid project data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create project" });
      }
    }
  });

  app.put("/api/projects/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, validatedData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  app.delete("/api/projects/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Skills
  app.get("/api/skills", async (req, res) => {
    try {
      const skills = await storage.getSkillsByCategory();
      res.json(skills);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch skills" });
    }
  });

  app.post("/api/skills", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSkillSchema.parse(req.body);
      const skill = await storage.createSkill(validatedData);
      res.status(201).json(skill);
    } catch (error) {
      res.status(400).json({ error: "Invalid skill data" });
    }
  });

  app.put("/api/skills/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSkillSchema.partial().parse(req.body);
      const skill = await storage.updateSkill(req.params.id, validatedData);
      res.json(skill);
    } catch (error) {
      res.status(400).json({ error: "Invalid skill data" });
    }
  });

  app.delete("/api/skills/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSkill(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete skill" });
    }
  });

  // Certificates
  app.get("/api/certificates", async (req, res) => {
    try {
      const certificates = await storage.getCertificates();
      res.json(certificates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });

  app.post("/api/certificates", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCertificateSchema.parse(req.body);
      const certificate = await storage.createCertificate(validatedData);
      res.status(201).json(certificate);
    } catch (error) {
      res.status(400).json({ error: "Invalid certificate data" });
    }
  });

  // Social Links
  app.get("/api/social", async (req, res) => {
    try {
      const links = await storage.getSocialLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch social links" });
    }
  });

  app.post("/api/social", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSocialLinkSchema.parse(req.body);
      const link = await storage.createSocialLink(validatedData);
      res.status(201).json(link);
    } catch (error) {
      res.status(400).json({ error: "Invalid social link data" });
    }
  });

  app.put("/api/social/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSocialLinkSchema.partial().parse(req.body);
      const link = await storage.updateSocialLink(req.params.id, validatedData);
      res.json(link);
    } catch (error) {
      res.status(400).json({ error: "Invalid social link data" });
    }
  });

  // Messages
  app.get("/api/messages", requireAdmin, async (req, res) => {
    try {
      const messages = await storage.getMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const validatedData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  app.put("/api/messages/:id/read", requireAdmin, async (req, res) => {
    try {
      await storage.markMessageAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });

  app.delete("/api/messages/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteMessage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Bio
  app.get("/api/bio", async (req, res) => {
    try {
      const bio = await storage.getBio();
      res.json(bio);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bio" });
    }
  });

  app.put("/api/bio", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBioSchema.parse(req.body);
      const bio = await storage.updateBio(validatedData);
      res.json(bio);
    } catch (error) {
      res.status(400).json({ error: "Invalid bio data" });
    }
  });

  // GitHub Stats
  app.get("/api/github-stats", async (req, res) => {
    try {
      const stats = await storage.getGithubStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch GitHub stats" });
    }
  });

  app.put("/api/github-stats", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertGithubStatsSchema.parse(req.body);
      const stats = await storage.updateGithubStats(validatedData);
      res.json(stats);
    } catch (error) {
      res.status(400).json({ error: "Invalid GitHub stats data" });
    }
  });

  // ASCII Art
  app.get("/api/ascii-art", async (req, res) => {
    try {
      const art = await storage.getAsciiArt();
      res.json(art);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ASCII art" });
    }
  });

  app.get("/api/ascii-art/:name", async (req, res) => {
    try {
      const art = await storage.getAsciiArtByName(req.params.name);
      if (!art) {
        return res.status(404).json({ error: "ASCII art not found" });
      }
      res.json(art);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ASCII art" });
    }
  });

  app.post("/api/ascii-art", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertAsciiArtSchema.parse(req.body);
      const art = await storage.createAsciiArt(validatedData);
      res.status(201).json(art);
    } catch (error) {
      res.status(400).json({ error: "Invalid ASCII art data" });
    }
  });

  // Data seeding endpoint removed

  const httpServer = createServer(app);
  return httpServer;
}
