import { 
  Project, 
  Skill, 
  Certificate, 
  SocialLink, 
  Message, 
  Bio, 
  GithubStats, 
  AsciiArt,
  Resume,
  InsertProject,
  InsertSkill,
  InsertCertificate,
  InsertSocialLink,
  InsertMessage,
  InsertBio,
  InsertGithubStats,
  InsertAsciiArt,
  InsertResume
} from "@shared/schema";
import { db, collections } from "./firebase";

export interface IStorage {
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Skills
  getSkills(): Promise<Skill[]>;
  getSkillsByCategory(): Promise<Record<string, Skill[]>>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: string, skill: Partial<InsertSkill>): Promise<Skill>;
  deleteSkill(id: string): Promise<void>;

  // Certificates
  getCertificates(): Promise<Certificate[]>;
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: string, certificate: Partial<InsertCertificate>): Promise<Certificate>;
  deleteCertificate(id: string): Promise<void>;

  // Social Links
  getSocialLinks(): Promise<SocialLink[]>;
  createSocialLink(link: InsertSocialLink): Promise<SocialLink>;
  updateSocialLink(id: string, link: Partial<InsertSocialLink>): Promise<SocialLink>;
  deleteSocialLink(id: string): Promise<void>;

  // Messages
  getMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<void>;
  deleteMessage(id: string): Promise<void>;

  // Bio
  getBio(): Promise<Bio | undefined>;
  updateBio(bio: InsertBio): Promise<Bio>;

  // GitHub Stats
  getGithubStats(): Promise<GithubStats | undefined>;
  updateGithubStats(stats: InsertGithubStats): Promise<GithubStats>;

  // ASCII Art
  getAsciiArt(): Promise<AsciiArt[]>;
  getAsciiArtByName(name: string): Promise<AsciiArt | undefined>;
  createAsciiArt(art: InsertAsciiArt): Promise<AsciiArt>;
  updateAsciiArt(id: string, art: Partial<InsertAsciiArt>): Promise<AsciiArt>;
  deleteAsciiArt(id: string): Promise<void>;

  // Resume
  getResume(): Promise<Resume | undefined>;
  updateResume(resume: InsertResume): Promise<Resume>;
}

export class FirestoreStorage implements IStorage {
  // Projects
  async getProjects(): Promise<Project[]> {
    const snapshot = await db.collection(collections.projects).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const doc = await db.collection(collections.projects).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Project : undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const docRef = await db.collection(collections.projects).add({
      ...project,
      createdAt: new Date(),
    });
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as Project;
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project> {
    await db.collection(collections.projects).doc(id).update(project);
    const doc = await db.collection(collections.projects).doc(id).get();
    return { id: doc.id, ...doc.data() } as Project;
  }

  async deleteProject(id: string): Promise<void> {
    await db.collection(collections.projects).doc(id).delete();
  }

  // Skills
  async getSkills(): Promise<Skill[]> {
    const snapshot = await db.collection(collections.skills).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Skill));
  }

  async getSkillsByCategory(): Promise<Record<string, Skill[]>> {
    const skills = await this.getSkills();
    return skills.reduce((acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    }, {} as Record<string, Skill[]>);
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    const docRef = await db.collection(collections.skills).add(skill);
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as Skill;
  }

  async updateSkill(id: string, skill: Partial<InsertSkill>): Promise<Skill> {
    await db.collection(collections.skills).doc(id).update(skill);
    const doc = await db.collection(collections.skills).doc(id).get();
    return { id: doc.id, ...doc.data() } as Skill;
  }

  async deleteSkill(id: string): Promise<void> {
    await db.collection(collections.skills).doc(id).delete();
  }

  // Certificates
  async getCertificates(): Promise<Certificate[]> {
    const snapshot = await db.collection(collections.certificates).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Certificate));
  }

  async createCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const docRef = await db.collection(collections.certificates).add(certificate);
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as Certificate;
  }

  async updateCertificate(id: string, certificate: Partial<InsertCertificate>): Promise<Certificate> {
    await db.collection(collections.certificates).doc(id).update(certificate);
    const doc = await db.collection(collections.certificates).doc(id).get();
    return { id: doc.id, ...doc.data() } as Certificate;
  }

  async deleteCertificate(id: string): Promise<void> {
    await db.collection(collections.certificates).doc(id).delete();
  }

  // Social Links
  async getSocialLinks(): Promise<SocialLink[]> {
    const snapshot = await db.collection(collections.socialLinks).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialLink));
  }

  async createSocialLink(link: InsertSocialLink): Promise<SocialLink> {
    const docRef = await db.collection(collections.socialLinks).add(link);
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as SocialLink;
  }

  async updateSocialLink(id: string, link: Partial<InsertSocialLink>): Promise<SocialLink> {
    await db.collection(collections.socialLinks).doc(id).update(link);
    const doc = await db.collection(collections.socialLinks).doc(id).get();
    return { id: doc.id, ...doc.data() } as SocialLink;
  }

  async deleteSocialLink(id: string): Promise<void> {
    await db.collection(collections.socialLinks).doc(id).delete();
  }

  // Messages
  async getMessages(): Promise<Message[]> {
    const snapshot = await db.collection(collections.messages).orderBy('timestamp', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const docRef = await db.collection(collections.messages).add({
      ...message,
      timestamp: new Date(),
      read: false,
    });
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as Message;
  }

  async markMessageAsRead(id: string): Promise<void> {
    await db.collection(collections.messages).doc(id).update({ read: true });
  }

  async deleteMessage(id: string): Promise<void> {
    await db.collection(collections.messages).doc(id).delete();
  }

  // Bio
  async getBio(): Promise<Bio | undefined> {
    const snapshot = await db.collection(collections.bio).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Bio;
  }

  async updateBio(bio: InsertBio): Promise<Bio> {
    const existing = await this.getBio();
    if (existing) {
      await db.collection(collections.bio).doc(existing.id).update({
        ...bio,
        lastUpdated: new Date(),
      });
      const doc = await db.collection(collections.bio).doc(existing.id).get();
      return { id: doc.id, ...doc.data() } as Bio;
    } else {
      const docRef = await db.collection(collections.bio).add({
        ...bio,
        lastUpdated: new Date(),
      });
      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() } as Bio;
    }
  }

  // GitHub Stats
  async getGithubStats(): Promise<GithubStats | undefined> {
    const snapshot = await db.collection(collections.githubStats).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as GithubStats;
  }

  async updateGithubStats(stats: InsertGithubStats): Promise<GithubStats> {
    const existing = await this.getGithubStats();
    if (existing) {
      await db.collection(collections.githubStats).doc(existing.id).update({
        ...stats,
        lastUpdated: new Date(),
      });
      const doc = await db.collection(collections.githubStats).doc(existing.id).get();
      return { id: doc.id, ...doc.data() } as GithubStats;
    } else {
      const docRef = await db.collection(collections.githubStats).add({
        ...stats,
        lastUpdated: new Date(),
      });
      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() } as GithubStats;
    }
  }

  // ASCII Art
  async getAsciiArt(): Promise<AsciiArt[]> {
    const snapshot = await db.collection(collections.asciiArt).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AsciiArt));
  }

  async getAsciiArtByName(name: string): Promise<AsciiArt | undefined> {
    const snapshot = await db.collection(collections.asciiArt).where('name', '==', name).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as AsciiArt;
  }

  async createAsciiArt(art: InsertAsciiArt): Promise<AsciiArt> {
    const docRef = await db.collection(collections.asciiArt).add(art);
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as AsciiArt;
  }

  async updateAsciiArt(id: string, art: Partial<InsertAsciiArt>): Promise<AsciiArt> {
    await db.collection(collections.asciiArt).doc(id).update(art);
    const doc = await db.collection(collections.asciiArt).doc(id).get();
    return { id: doc.id, ...doc.data() } as AsciiArt;
  }

  async deleteAsciiArt(id: string): Promise<void> {
    await db.collection(collections.asciiArt).doc(id).delete();
  }

  // Resume
  async getResume(): Promise<Resume | undefined> {
    const doc = await db.collection(collections.resume).doc('current').get();
    if (!doc.exists) return undefined;
    
    // Get GitHub stats to include in response
    const githubStats = await this.getGithubStats();
    const resumeData = doc.data() as Resume;
    
    return {
      ...resumeData,
      githubStats: githubStats ? {
        stars: githubStats.stars,
        commits: githubStats.commits,
        repos: githubStats.repos,
        followers: githubStats.followers,
        pullRequests: githubStats.pullRequests,
        issues: githubStats.issues
      } : undefined
    };
  }

  async updateResume(resume: InsertResume): Promise<Resume> {
    const data = {
      ...resume,
      lastUpdated: new Date()
    };
    
    await db.collection(collections.resume).doc('current').set(data);
    return {
      id: 'current',
      ...data
    } as Resume;
  }
}

export const storage = new FirestoreStorage();
