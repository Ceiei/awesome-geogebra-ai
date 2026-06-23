import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3001);
const app = createApp();

if (process.env.NODE_ENV === "production") {
  const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
  const distDirectory = path.resolve(serverDirectory, "../dist");

  app.use(express.static(distDirectory));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(distDirectory, "index.html"));
  });
}

app.listen(port, () => {
  console.log("GeoGebra AI 服务已启动：http://localhost:" + port);
});
