import '../ant-ui/styles.css';
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "@ant-ui/styles.css";
import "@shared-ui/tailwind.css";

const basename = window.location.pathname.startsWith("/workspace/training/researcher")
  ? "/workspace/training/researcher"
  : undefined;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
