import { z } from "zod";
import {
  type ExecomMember,
  type Activity,
  type Achievement,
  type ContactForm,
  execomMemberSchema,
  activitySchema,
  achievementSchema,
} from "@shared/schema";
import fs from "fs";
import path from "path";

// Storage interface for IEEE SIGHT website data
export interface IStorage {
  getExecomMembers(): Promise<ExecomMember[]>;
  getActivities(): Promise<Activity[]>;
  getAchievements(): Promise<Achievement[]>;
  submitContactForm(form: ContactForm): Promise<void>;
}

export class MemStorage implements IStorage {
  private execomMembers: ExecomMember[];
  private activities: Activity[];
  private achievements: Achievement[];

  constructor() {
    this.execomMembers = [];
    this.activities = [];
    this.achievements = [];
    // Try to load initial data from client JSON files (development convenience)
    try {
      const dataDir = path.resolve(import.meta.dirname, "..", "client", "src", "data");
      const readJson = (file: string) =>
        JSON.parse(fs.readFileSync(path.resolve(dataDir, file), "utf-8"));

      const execom = z.array(execomMemberSchema).safeParse(readJson("execom.json"));
      const activities = z.array(activitySchema).safeParse(readJson("activities.json"));
      const achievements = z.array(achievementSchema).safeParse(readJson("achievements.json"));

      if (execom.success) this.execomMembers = execom.data;
      if (activities.success) this.activities = activities.data;
      if (achievements.success) this.achievements = achievements.data;
    } catch {
      // Ignore if files are missing in production or paths change
    }
  }

  async getExecomMembers(): Promise<ExecomMember[]> {
    return this.execomMembers;
  }

  async getActivities(): Promise<Activity[]> {
    return this.activities;
  }

  async getAchievements(): Promise<Achievement[]> {
    return this.achievements;
  }

  async submitContactForm(form: ContactForm): Promise<void> {
    // In a real implementation, this would save to database
    console.log('Contact form submitted:', form);
  }
}

export const storage = new MemStorage();
