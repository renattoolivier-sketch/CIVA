import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser
  app.use(express.json());

  // API Route to expand Google Maps short links
  app.get("/api/expand-link", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      // Follow redirects to get the final URL
      const response = await axios.get(url, {
        maxRedirects: 5,
        // We only need the URL, so we can use HEAD if supported, 
        // but some shorteners behave differently for HEAD.
        // Also disable validation of status codes to catch redirects.
        validateStatus: (status) => status >= 200 && status < 400,
      });
      
      const finalUrl = response.request.res.responseUrl || url;
      res.json({ finalUrl });
    } catch (error) {
      console.error("Error expanding URL:", error);
      res.status(500).json({ error: "Failed to expand URL" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
