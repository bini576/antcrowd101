import '../ant-ui/styles.css';
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "@ant-ui/styles.css";
import "./styles.css";

const basename = window.location.pathname.startsWith("/workspace/vdp/researcher")
  ? "/workspace/vdp/researcher"
  : undefined;

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
