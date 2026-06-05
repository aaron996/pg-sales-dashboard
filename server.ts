import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/send-email", express.json(), async (req, res) => {
    const { email, displayName } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY is not configured locally.");
      return res.status(500).json({ error: "Mail server configuration error (RESEND_API_KEY missing)." });
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "P&G Sales Dashboard <onboarding@resend.dev>",
          to: ["luongthevinh996@gmail.com"],
          subject: "Yêu cầu duyệt tài khoản báo cáo Interdist (Local Test)",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2>Yêu Cầu Duyệt Tài Khoản Mới (Local Test)</h2>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Tên hiển thị:</strong> ${displayName || 'Chưa cung cấp'}</p>
            </div>
          `,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to send email");
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Error sending local email:", error);
      res.status(500).json({ error: error.message || String(error) });
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
