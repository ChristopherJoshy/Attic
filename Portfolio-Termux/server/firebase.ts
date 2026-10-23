import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

let app;
if (getApps().length === 0) {
  app = initializeApp({
    credential: cert(firebaseConfig),
  });
} else {
  app = getApp();
}

export const db = getFirestore(app);

// Collection helpers
export const collections = {
  projects: 'projects',
  skills: 'skills',
  certificates: 'certificates',
  socialLinks: 'socialLinks',
  messages: 'messages',
  bio: 'bio',
  githubStats: 'githubStats',
  asciiArt: 'asciiArt',
  resume: 'resume'
} as const;
