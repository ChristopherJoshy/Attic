import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);
