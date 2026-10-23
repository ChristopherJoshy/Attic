export interface Skill {
  id: string;
  name: string;
  level: number;
  icon: string;
  experience: string;
  category: "languages" | "frameworks" | "tools" | "data" | "game";
}

export const skills: Skill[] = [
  // Languages based on your most used languages
  {
    id: "jupyter",
    name: "Jupyter Notebook",
    level: 85,
    icon: "https://cdn.iconscout.com/icon/free/png-256/jupyter-3-1175091.png",
    experience: "25.06% usage in projects",
    category: "languages"
  },
  {
    id: "typescript",
    name: "TypeScript",
    level: 83,
    icon: "https://cdn.iconscout.com/icon/free/png-256/typescript-1174965.png",
    experience: "24.83% usage in projects",
    category: "languages"
  },
  {
    id: "javascript",
    name: "JavaScript",
    level: 80,
    icon: "https://cdn.iconscout.com/icon/free/png-256/javascript-2752148-2284965.png",
    experience: "20.01% usage in projects",
    category: "languages"
  },
  {
    id: "css",
    name: "CSS",
    level: 71,
    icon: "https://cdn.iconscout.com/icon/free/png-256/css-131-722685.png",
    experience: "11.64% usage in projects",
    category: "languages"
  },
  {
    id: "html",
    name: "HTML",
    level: 69,
    icon: "https://cdn.iconscout.com/icon/free/png-256/html5-40-1175193.png",
    experience: "9.65% usage in projects",
    category: "languages"
  },
  {
    id: "dart",
    name: "Dart",
    level: 58,
    icon: "https://cdn.iconscout.com/icon/free/png-256/dart-2752184-2285001.png", 
    experience: "8.81% usage in projects",
    category: "languages"
  },
  {
    id: "python",
    name: "Python",
    level: 80,
    icon: "https://cdn.iconscout.com/icon/free/png-256/python-2-226051.png",
    experience: "Used in AI/ML projects",
    category: "languages"
  },
  {
    id: "java",
    name: "Java",
    level: 70,
    icon: "https://cdn.iconscout.com/icon/free/png-256/java-43-569305.png",
    experience: "Used in multiple projects",
    category: "languages"
  },
  {
    id: "c-sharp",
    name: "C#",
    level: 65,
    icon: "https://cdn.iconscout.com/icon/free/png-256/csharp-1175240.png",
    experience: "Currently mastering",
    category: "languages"
  },
  {
    id: "cpp",
    name: "C++",
    level: 60,
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg",
    experience: "Used in system programming",
    category: "languages"
  },
  
  // Frameworks
  {
    id: "react",
    name: "React",
    level: 90,
    icon: "https://cdn.iconscout.com/icon/free/png-256/react-1-282599.png",
    experience: "Used in multiple web projects",
    category: "frameworks"
  },
  {
    id: "nodejs",
    name: "Node.js",
    level: 85,
    icon: "https://cdn.iconscout.com/icon/free/png-256/nodejs-2-226035.png",
    experience: "Used for server-side applications",
    category: "frameworks"
  },
  {
    id: "express",
    name: "Express",
    level: 80,
    icon: "https://cdn.iconscout.com/icon/free/png-256/express-8-1175029.png",
    experience: "Used for RESTful APIs",
    category: "frameworks"
  },
  {
    id: "threejs",
    name: "Three.js",
    level: 75,
    icon: "https://cdn.iconscout.com/icon/free/png-256/threejs-1-1175143.png",
    experience: "Used for 3D visualizations",
    category: "frameworks"
  },
  {
    id: "vite",
    name: "Vite",
    level: 75,
    icon: "https://vitejs.dev/logo.svg",
    experience: "Modern build tool for web apps",
    category: "frameworks"
  },
  
  // Tools & Platforms
  {
    id: "firebase",
    name: "Firebase",
    level: 85,
    icon: "https://cdn.iconscout.com/icon/free/png-256/firebase-1-282796.png",
    experience: "Used for authentication & storage",
    category: "tools"
  },
  {
    id: "git",
    name: "Git",
    level: 90,
    icon: "https://cdn.iconscout.com/icon/free/png-256/git-17-1175218.png",
    experience: "Version control for all projects",
    category: "tools"
  },
  {
    id: "google-cloud",
    name: "Google Cloud",
    level: 75,
    icon: "https://cdn.iconscout.com/icon/free/png-256/google-cloud-2038785-1721675.png",
    experience: "Cloud platform for applications",
    category: "tools"
  },
  {
    id: "aws",
    name: "AWS",
    level: 70,
    icon: "https://cdn.iconscout.com/icon/free/png-256/aws-1869025-1583149.png",
    experience: "Cloud services platform",
    category: "tools"
  },
  {
    id: "mongodb",
    name: "MongoDB",
    level: 75,
    icon: "https://cdn.iconscout.com/icon/free/png-256/mongodb-3-1175138.png",
    experience: "NoSQL database for applications",
    category: "tools"
  },
  {
    id: "docker",
    name: "Docker",
    level: 70,
    icon: "https://cdn.iconscout.com/icon/free/png-256/docker-13-1175230.png",
    experience: "Container platform",
    category: "tools"
  },
  {
    id: "postman",
    name: "Postman",
    level: 80,
    icon: "https://cdn.iconscout.com/icon/free/png-256/postman-3521648-2945092.png",
    experience: "API testing and development",
    category: "tools"
  },
  
  // Data Science & ML
  {
    id: "tensorflow",
    name: "TensorFlow",
    level: 75,
    icon: "https://cdn.iconscout.com/icon/free/png-256/tensorflow-2-1175112.png",
    experience: "ML model development",
    category: "data"
  },
  {
    id: "numpy",
    name: "NumPy",
    level: 80,
    icon: "https://cdn.iconscout.com/icon/free/png-256/numpy-2-1175118.png",
    experience: "Numerical computing",
    category: "data"
  },
  {
    id: "scikit-learn",
    name: "Scikit-learn",
    level: 75,
    icon: "https://upload.wikimedia.org/wikipedia/commons/0/05/Scikit_learn_logo_small.svg",
    experience: "ML algorithms",
    category: "data"
  },
  
  // Game Development
  {
    id: "unreal",
    name: "Unreal Engine",
    level: 60,
    icon: "https://cdn.iconscout.com/icon/free/png-256/unreal-engine-2749375-2284765.png",
    experience: "Game development",
    category: "game"
  }
];
