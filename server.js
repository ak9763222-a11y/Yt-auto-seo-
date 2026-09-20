const express = require("express");
const { google } = require("googleapis");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://yt-auto-seo.onrender.com/oauth2callback";

// Home page
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>YT Auto SEO</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f5f5f5;
          text-align: center;
          padding: 40px 20px;
        }
        .box {
          max-width: 500px;
          margin: auto;
          background: white;
          padding: 30px;
          border-radius: 15px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        h1 {
          margin-bottom: 10px;
        }
        p {
          color: #555;
        }
        a {
          display: inline-block;
          margin-top: 20px;
          padding: 14px 25px;
          background: #ff0000;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>YT Auto SEO</h1>
        <p>YouTube SEO Tool</p>
        <p>Connect your Google account to continue.</p>
        <a href="/auth/google">Connect Google / YouTube</a>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "YT Auto SEO"
  });
});

// Google OAuth start
app.get("/auth/google", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res
      .status(500)
      .send("Google OAuth settings are not configured.");
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/youtube"
    ]
  });

  res.redirect(authUrl);
});

// Google OAuth callback
app.get("/oauth2callback", async (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res
        .status(500)
        .send("Google OAuth settings are not configured.");
    }

    const code = req.query.code;

    if (!code) {
      return res
        .status(400)
        .send("Authorization code is missing.");
    }

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    res.send(`
      <html>
      <body style="font-family:Arial;text-align:center;padding:40px;">
        <h1>Google Connected Successfully ✅</h1>
        <p>Your YouTube authorization was successful.</p>
        <p>You can now return to YT Auto SEO.</p>
      </body>
      </html>
    `);

    console.log("YouTube authorization successful.");
    console.log("Refresh token received:", !!tokens.refresh_token);

  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).send("Google authorization failed.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`YT Auto SEO server running on port ${PORT}`);
});
