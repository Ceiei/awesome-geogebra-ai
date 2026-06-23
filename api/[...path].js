import { createApp } from "../server/app.js";

export const config = {
  api: {
    bodyParser: false
  }
};

const app = createApp();

export default function handler(req, res) {
  if (!req.url.startsWith("/api/")) {
    req.url = "/api" + req.url;
  }

  return app(req, res);
}
