import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import "./styles/tokens.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/battle-pass.css";
import "./styles/collection.css";
import "./styles/play-hub.css";
import "./styles/factions.css";
import "./styles/post-match.css";
import "./styles/second-level.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
