import { getAssetPath } from '../utils/paths';

export interface Project {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  image: string;
  technologies: string[];
  features: string[];
  period: string;
  githubUrl: string;
  demoUrl: string | null;
}

export const projects: Project[] = [
  {
    id: "maestramind",
    title: "MaestraMind - Advanced Music Learning Platform",
    shortTitle: "MaestraMind",
    description: "A comprehensive music learning platform that combines interactive lessons, practice tools, and AI-powered feedback to help users master musical instruments and theory.",
    image: "/assets/projects/maestramind.svg",
    technologies: ["React.js", "Firebase", "Google Gemini API", "JavaScript"],
    features: [
      "Upload Multiple Notes (text input or file)",
      "Gemini AI-Powered Note Analysis",
      "Auto-Generated Courses and Topics",
      "Personalized Adaptive Learning Paths",
      "Real-Time Progress Tracking",
      "AI-Generated Summaries, Flashcards, and Quizzes",
      "Smart Recommendations based on user behavior",
      "Firebase Google Authentication and Firestore Integration"
    ],
    period: "November 2024 - Present",
    githubUrl: "https://github.com/ChristopherJoshy/MaestraMind",
    demoUrl: "https://christopherjoshy.github.io/MaestraMind/"
  },
  {
    id: "kknotes",
    title: "KKNotes - Secure Note Taking App",
    shortTitle: "KKNotes",
    description: "A secure, feature-rich note-taking application with end-to-end encryption, real-time sync, and collaborative editing capabilities.",
    image: "/assets/projects/kknotes.svg",
    technologies: ["JavaScript", "React", "HTML/CSS", "Firebase"],
    features: [
      "Created a comprehensive study resource platform for KTU CSE students",
      "Designed and implemented a responsive UI with intuitive navigation",
      "Developed a system for organizing and presenting high-quality notes and tutorials",
      "Implemented content categorization and search functionality",
      "Optimized the platform for multiple devices, increasing mobile engagement by 35%"
    ],
    period: "June 2023 - October 2023",
    githubUrl: "https://github.com/ChristopherJoshy/KKNotesV2",
    demoUrl: "https://christopherjoshy.github.io/KKNotesV2/"
  },
  {
    id: "sonarsight",
    title: "SonarSight - Social Media Analytics Dashboard",
    shortTitle: "SonarSight",
    description: "A comprehensive social media analytics dashboard providing insights, trend analysis, and content performance metrics across multiple platforms.",
    image: "/assets/projects/sonarsight.svg",
    technologies: ["JavaScript", "Chrome Extensions API", "Google Gemini API", "Perplexity API"],
    features: [
      "AI-powered text analysis with multiple providers (Google Gemini & Perplexity)",
      "Intelligent follow-up question suggestions based on content analysis",
      "Citations with source links for fact-checking",
      "Notebook functionality to save important insights",
      "History tracking of all your queries",
      "Customizable settings with your own API keys",
      "Light and dark theme support",
      "Keyboard shortcuts for quick access"
    ],
    period: "January 2025 - March 2025",
    githubUrl: "https://github.com/ChristopherJoshy/SonarSight",
    demoUrl: null
  },
  {
    id: "quiz-website",
    title: "Simple Quiz Website",
    shortTitle: "Quiz Website",
    description: "An interactive quiz platform with multiple categories, difficulty levels, and scoring system to test knowledge and learn new facts.",
    image: "/assets/projects/quiz-website.svg",
    technologies: ["JavaScript", "HTML", "CSS"],
    features: [
      "Dynamic question loading from JSON",
      "Timer functionality for each question",
      "Score tracking and instant feedback",
      "Responsive design for all devices",
      "Progress indicator for quiz completion"
    ],
    period: "May 2023 - June 2023",
    githubUrl: "https://github.com/ChristopherJoshy/Simple-Quiz-Website",
    demoUrl: "https://github.com/ChristopherJoshy/Simple-Quiz-Website"
  },
  {
    id: "hexinox",
    title: "Hexinox - E-commerce Template for MakeIT",
    shortTitle: "Hexinox",
    description: "A modern, responsive e-commerce website template designed for the fictional MakeIT brand, featuring product catalog, shopping cart, and checkout functionality.",
    image: "/assets/projects/hexinox.svg",
    technologies: ["Dart", "Flutter"],
    features: [
      "Cross-platform mobile application",
      "Intuitive user interface",
      "Real-time data synchronization",
      "Offline capability",
      "Responsive design"
    ],
    period: "August 2023 - September 2023",
    githubUrl: "https://github.com/ChristopherJoshy/Hexinox-MakeIT",
    demoUrl: null
  },
  {
    id: "expense-tracker",
    title: "Expense Tracker - Personal Finance Manager",
    shortTitle: "Expense Tracker",
    description: "A comprehensive personal finance management tool for tracking expenses, setting budgets, and visualizing spending patterns.",
    image: "/assets/projects/expense-tracker.svg",
    technologies: ["C"],
    features: [
      "File-based data storage",
      "Category-based expense tracking",
      "Monthly and yearly expense reports",
      "Budget setting and alerts",
      "Simple command-line interface"
    ],
    period: "February 2023 - March 2023",
    githubUrl: "https://github.com/ChristopherJoshy/ExpenseTracker",
    demoUrl: null
  }
];
