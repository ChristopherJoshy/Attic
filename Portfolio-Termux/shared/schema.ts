import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  techStack: z.array(z.string()),
  liveDemo: z.string().optional(),
  github: z.string().optional(),
  asciiArt: z.string(),
  status: z.enum(["development", "production", "archived"]),
  featured: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
});

export const skillSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  proficiency: z.number().min(1).max(100),
  yearsOfExperience: z.number(),
});

export const certificateSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  issuer: z.string(),
  dateIssued: z.date(),
  credentialUrl: z.string().optional(),
});

export const socialLinkSchema = z.object({
  id: z.string(),
  platform: z.string(),
  url: z.string(),
  username: z.string(),
  displayName: z.string(),
});

export const messageSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  message: z.string(),
  timestamp: z.date().default(() => new Date()),
  read: z.boolean().default(false),
});

export const bioSchema = z.object({
  id: z.string(),
  content: z.string(),
  lastUpdated: z.date().default(() => new Date()),
});

export const githubStatsSchema = z.object({
  id: z.string(),
  stars: z.number(),
  commits: z.number(),
  repos: z.number(),
  followers: z.number(),
  pullRequests: z.number(),
  issues: z.number(),
  lastUpdated: z.date().default(() => new Date()),
});

export const asciiArtSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  description: z.string().optional(),
});

export const resumeSchema = z.object({
  id: z.string(),
  url: z.string(),
  lastUpdated: z.date().default(() => new Date()),
  githubStats: githubStatsSchema.omit({ id: true, lastUpdated: true }).optional(),
});

// Insert schemas
export const insertProjectSchema = projectSchema.omit({ id: true, createdAt: true });
export const insertSkillSchema = skillSchema.omit({ id: true });
export const insertCertificateSchema = certificateSchema.omit({ id: true });
export const insertSocialLinkSchema = socialLinkSchema.omit({ id: true });
export const insertMessageSchema = messageSchema.omit({ id: true, timestamp: true, read: true });
export const insertBioSchema = bioSchema.omit({ id: true, lastUpdated: true });
export const insertGithubStatsSchema = githubStatsSchema.omit({ id: true, lastUpdated: true });
export const insertAsciiArtSchema = asciiArtSchema.omit({ id: true });
export const insertResumeSchema = resumeSchema.omit({ id: true, lastUpdated: true });

// Types
export type Project = z.infer<typeof projectSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Certificate = z.infer<typeof certificateSchema>;
export type SocialLink = z.infer<typeof socialLinkSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Bio = z.infer<typeof bioSchema>;
export type GithubStats = z.infer<typeof githubStatsSchema>;
export type AsciiArt = z.infer<typeof asciiArtSchema>;
export type Resume = z.infer<typeof resumeSchema>;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type InsertSocialLink = z.infer<typeof insertSocialLinkSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertBio = z.infer<typeof insertBioSchema>;
export type InsertGithubStats = z.infer<typeof insertGithubStatsSchema>;
export type InsertAsciiArt = z.infer<typeof insertAsciiArtSchema>;
export type InsertResume = z.infer<typeof insertResumeSchema>;

export interface TerminalCommand {
  name: string;
  description: string;
  handler: (args: string[]) => Promise<string> | string;
  adminOnly?: boolean;
}

export interface AdminSession {
  authenticated: boolean;
  timestamp: number;
}
