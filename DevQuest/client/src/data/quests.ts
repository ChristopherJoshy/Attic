export interface Quest {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: "active" | "locked";
  progress: number;
}

export const quests: Quest[] = [
  // Current Focus Areas (Active Quests)
  {
    id: "llm-finetuning",
    title: "LLM Fine-tuning",
    description: "Large Language Model fine-tuning and prompt engineering for domain-specific applications.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/artificial-intelligence-2-1157508.png",
    status: "active",
    progress: 65
  },
  {
    id: "rust-programming",
    title: "Rust Programming",
    description: "Learning Rust for high-performance, memory-safe systems programming and WebAssembly integration.",
    icon: "https://rust-lang.org/logos/rust-logo-512x512.png",
    status: "active",
    progress: 40
  },
  {
    id: "web3-architecture",
    title: "Web3 Architecture",
    description: "Web3 architecture and zero-knowledge proof implementations for privacy-preserving applications.",
    icon: "https://cdn.iconscout.com/icon/free/png-256/blockchain-3001237-2495564.png",
    status: "active",
    progress: 30
  },
  {
    id: "cybersecurity",
    title: "Advanced Cybersecurity",
    description: "Advanced cybersecurity practices with focus on AI-based threat detection.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/cyber-security-1527835-1295288.png",
    status: "active",
    progress: 50
  },
  {
    id: "edge-computing",
    title: "Edge Computing",
    description: "Edge computing optimizations for IoT and embedded ML model deployment.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/edge-computing-3981503-3297650.png",
    status: "active",
    progress: 25
  },
  
  // Future Aspirations (Locked Quests)
  {
    id: "sustainable-dev",
    title: "Sustainable Development",
    description: "Pioneer sustainable development practices through green coding and carbon-efficient algorithms.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/green-energy-1491399-1262950.png",
    status: "locked",
    progress: 0
  },
  {
    id: "cognitive-computing",
    title: "Cognitive Computing",
    description: "Build cognitive computing solutions that responsibly augment human decision-making.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/machine-learning-1517814-1287188.png",
    status: "locked",
    progress: 0
  },
  {
    id: "quantum-ready",
    title: "Quantum-Ready Architectures",
    description: "Develop composable architecture patterns for quantum-ready distributed systems.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/quantum-computer-2321824-1932383.png",
    status: "locked",
    progress: 0
  },
  {
    id: "federated-ai",
    title: "Federated AI",
    description: "Contribute to open standards in federated AI and platform-agnostic neural interfaces.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/ai-26-860843.png",
    status: "locked",
    progress: 0
  },
  {
    id: "ar-vr-learning",
    title: "AR/VR Learning Systems",
    description: "Lead cross-disciplinary projects combining AR/VR with adaptive learning systems.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/augmented-reality-55-1023321.png",
    status: "locked",
    progress: 0
  },
  {
    id: "accessible-tech",
    title: "Accessible Technology",
    description: "Design accessible tech that bridges digital divides for underserved communities.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/accessible-technology-3254682-2715254.png",
    status: "locked",
    progress: 0
  },
  {
    id: "tech-startup",
    title: "Human-Centered AI Startup",
    description: "Launch a tech startup focused on human-centered AI solutions for real-world problems.",
    icon: "https://cdn.iconscout.com/icon/premium/png-256-thumb/startup-idea-3025234-2523366.png",
    status: "locked",
    progress: 0
  }
];
