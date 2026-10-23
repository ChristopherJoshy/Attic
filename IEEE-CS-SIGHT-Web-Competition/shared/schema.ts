import { z } from "zod";

// Execom Member Schema
export const execomMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  contact: z.string(),
  avatar: z.string().optional(),
  initials: z.string(),
});

export type ExecomMember = z.infer<typeof execomMemberSchema>;

// Activity Schema
export const activitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  image: z.string(),
  status: z.enum(["upcoming", "past"]),
  date: z.string(),
  tags: z.array(z.string()),
});

export type Activity = z.infer<typeof activitySchema>;

// Achievement Schema
export const achievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  year: z.string(),
  image: z.string().optional(),
  icon: z.string().optional(),
});

export type Achievement = z.infer<typeof achievementSchema>;

// Contact Form Schema
export const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(1, "Please select a subject"),
  message: z.string().min(10, "Message must be at least 10 characters long"),
});

export type ContactForm = z.infer<typeof contactFormSchema>;

// Statistics Schema
export const statisticsSchema = z.object({
  livesImpacted: z.number(),
  projectsCompleted: z.number(),
  communityPartners: z.number(),
  yearsActive: z.number(),
});

export type Statistics = z.infer<typeof statisticsSchema>;
