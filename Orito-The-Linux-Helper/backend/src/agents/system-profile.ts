/**
 * System Profile Auto-Detection Module
 * 
 * This module provides functionality for automatic system profile detection
 * through interactive user questions. It's used by the Curious Agent and
 * Orchestrator to collect system information when command-based discovery
 * is not available or as a preferred user-friendly alternative.
 * 
 * Features:
 * - Question-based profile collection with rich UI options
 * - Auto-detection of package managers based on distribution
 * - Profile persistence to chat context and database
 * - Graceful handling of missing or incomplete data
 */

import { Chat } from '../models/chat.js';
import type { SystemProfile, AgentQuestion } from '../types.js';
import type { IChat } from '../models/chat.js';

export interface SystemProfileData {
  distro: string;
  version: string;
  packageManager: string;
  shell: string;
  desktopEnvironment: string;
  detectedAt: Date;
}

// Define system profile questions with options
const SYSTEM_PROFILE_QUESTIONS: AgentQuestion[] = [
  {
    question: 'distro',
    header: 'What Linux distribution are you using?',
    options: [
      { label: 'Ubuntu', description: 'Popular Debian-based distro' },
      { label: 'Fedora', description: 'RPM-based, cutting edge' },
      { label: 'Arch Linux', description: 'Rolling release, DIY' },
      { label: 'Debian', description: 'Stable, server-focused' },
      { label: 'Manjaro', description: 'User-friendly Arch-based' },
      { label: 'Pop!_OS', description: 'Ubuntu-based, NVIDIA optimized' },
      { label: 'Linux Mint', description: 'Ubuntu-based, beginner-friendly' },
      { label: 'openSUSE', description: 'YaST-based, stable' },
      { label: 'CentOS/RHEL', description: 'Enterprise-grade' },
      { label: 'Other', description: 'Specify your own' },
    ],
    multiple: false,
  },
  {
    question: 'version',
    header: 'What version are you using?',
    options: [
      { label: '24.04 LTS / Latest', description: 'Most recent stable' },
      { label: '22.04 LTS', description: 'Long-term support' },
      { label: '20.04 LTS', description: 'Older stable' },
      { label: 'Rolling release', description: 'Always latest' },
      { label: "I don't know", description: 'Skip this question' },
    ],
    multiple: false,
  },
  {
    question: 'packageManager',
    header: 'What package manager do you use?',
    options: [
      { label: 'apt', description: 'Debian/Ubuntu default' },
      { label: 'dnf', description: 'Fedora default' },
      { label: 'pacman', description: 'Arch/Manjaro default' },
      { label: 'zypper', description: 'openSUSE default' },
      { label: 'yum', description: 'Legacy RHEL/CentOS' },
      { label: 'Auto-detect', description: 'Based on distribution' },
    ],
    multiple: false,
  },
  {
    question: 'shell',
    header: 'What shell do you use?',
    options: [
      { label: 'bash', description: 'Most common default' },
      { label: 'zsh', description: 'Powerful, customizable' },
      { label: 'fish', description: 'User-friendly features' },
      { label: 'Auto-detect', description: 'Use system default' },
    ],
    multiple: false,
  },
  {
    question: 'desktopEnvironment',
    header: 'What desktop environment?',
    options: [
      { label: 'GNOME', description: 'Modern, touch-friendly' },
      { label: 'KDE Plasma', description: 'Customizable, Windows-like' },
      { label: 'XFCE', description: 'Lightweight, traditional' },
      { label: 'Cinnamon', description: 'Linux Mint default' },
      { label: 'MATE', description: 'Classic GNOME 2 feel' },
      { label: 'i3/Sway', description: 'Tiling window manager' },
      { label: 'None (CLI only)', description: 'Server/terminal only' },
      { label: "I don't know", description: 'Skip this question' },
    ],
    multiple: false,
  },
];

// Map distributions to their default package managers
const DISTRO_TO_PACKAGE_MANAGER: Record<string, string> = {
  'Ubuntu': 'apt',
  'Debian': 'apt',
  'Linux Mint': 'apt',
  'Pop!_OS': 'apt',
  'Fedora': 'dnf',
  'CentOS/RHEL': 'dnf',
  'Arch Linux': 'pacman',
  'Manjaro': 'pacman',
  'openSUSE': 'zypper',
};

/**
 * Check if system profile exists and is complete
 * Returns the profile if complete, null if not
 */
export function getExistingSystemProfile(
  chat: IChat
): SystemProfileData | null {
  if (!chat.systemProfile || !chat.context?.systemProfile) {
    return null;
  }

  const profile = chat.context.systemProfile as SystemProfileData;

  // Check if profile has all required fields
  const requiredFields = ['distro', 'packageManager', 'shell', 'desktopEnvironment'];
  const hasAllFields = requiredFields.every(field =>
    profile[field as keyof SystemProfileData] &&
    profile[field as keyof SystemProfileData] !== "I don't know" &&
    profile[field as keyof SystemProfileData] !== 'Auto-detect'
  );

  if (!hasAllFields) {
    return null;
  }

  return profile;
}

/**
 * Auto-detect package manager based on distribution
 */
function autoDetectPackageManager(distro: string): string {
  return DISTRO_TO_PACKAGE_MANAGER[distro] || 'apt';
}

/**
 * Convert user answers to SystemProfileData
 */
function answersToProfile(answers: Record<string, string | string[]>): SystemProfileData {
  let distro = (answers['distro'] as string) || 'Unknown';
  let version = (answers['version'] as string) || 'Unknown';
  let packageManager = (answers['packageManager'] as string) || 'Auto-detect';
  let shell = (answers['shell'] as string) || 'Auto-detect';
  let desktopEnvironment = (answers['desktopEnvironment'] as string) || "I don't know";

  // Auto-detect package manager if needed
  if (packageManager === 'Auto-detect') {
    packageManager = autoDetectPackageManager(distro);
  }

  // Auto-detect shell if needed
  if (shell === 'Auto-detect') {
    shell = 'bash'; // Most common default
  }

  // Handle "I don't know" responses
  if (version === "I don't know") version = 'Unknown';
  if (desktopEnvironment === "I don't know") desktopEnvironment = 'Unknown';

  return {
    distro,
    version,
    packageManager,
    shell,
    desktopEnvironment,
    detectedAt: new Date(),
  };
}

/**
 * Check if profile exists and ask confirmation if needed
 * Returns the profile or triggers question flow
 */
export async function ensureSystemProfile(
  chat: IChat,
  userId: string,
  askUserQuestion: (
    question: string,
    options: string[],
    allowCustom: boolean
  ) => Promise<string>
): Promise<SystemProfileData | null> {
  const existingProfile = getExistingSystemProfile(chat);

  if (existingProfile) {
    // Profile exists - ask for confirmation
    const profileStr = `${existingProfile.distro} ${existingProfile.version} with ${existingProfile.packageManager}`;
    const isCorrect = await askUserQuestion(
      `I have your system as ${profileStr}. Is this still correct?`,
      ['Yes', 'No, update it'],
      false
    );

    if (isCorrect === 'Yes') {
      return existingProfile;
    }
    // User wants to update - continue to collection
  }

  return null; // Need to collect profile
}

/**
 * Collect system profile via questions
 * Returns the collected profile
 */
export async function collectSystemProfile(
  chat: IChat,
  userId: string,
  askUserQuestions: (questions: AgentQuestion[]) => Promise<Record<string, string | string[]>>,
  saveToDatabase: (chatId: string, profile: SystemProfileData) => Promise<void>
): Promise<SystemProfileData> {
  // Ask all questions
  const answers = await askUserQuestions(SYSTEM_PROFILE_QUESTIONS);

  // Convert answers to profile
  const profile = answersToProfile(answers);

  // Save to database
  await saveToDatabase(chat._id.toString(), profile);

  return profile;
}

/**
 * Convert SystemProfileData to the legacy SystemProfile format
 */
export function convertToLegacyProfile(profile: SystemProfileData): SystemProfile {
  return {
    distro: profile.distro,
    distroVersion: profile.version,
    kernel: null,
    packageManager: profile.packageManager,
    cpuModel: null,
    gpuInfo: null,
    shell: profile.shell,
    displayServer: null,
    windowManager: null,
    desktopEnvironment: profile.desktopEnvironment === 'None (CLI only)' ? null : profile.desktopEnvironment,
    collectedAt: profile.detectedAt.toISOString(),
  };
}

/**
 * Format system profile for display in prompts
 */
export function formatSystemProfileForPrompt(profile: SystemProfileData): string {
  return `## User's System Profile
- Distribution: ${profile.distro} ${profile.version}
- Package Manager: ${profile.packageManager}
- Shell: ${profile.shell}
- Desktop Environment: ${profile.desktopEnvironment}`;
}

/**
 * Check if system profile is incomplete (needs collection)
 */
export function isProfileIncomplete(chat: IChat): boolean {
  return getExistingSystemProfile(chat) === null;
}

/**
 * Get partial profile data if available (for progressive enhancement)
 */
export function getPartialProfile(chat: IChat): Partial<SystemProfileData> {
  if (chat.context?.systemProfile) {
    return chat.context.systemProfile as Partial<SystemProfileData>;
  }
  return {};
}
