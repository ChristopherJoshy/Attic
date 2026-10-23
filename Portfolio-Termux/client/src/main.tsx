import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Prevent unhandled promise rejections from causing page reloads
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

// Prevent uncaught errors from causing page reloads
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
