const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Temporary token storage
const TOKEN_FILE = path.join("/tmp", "youtube-token.json");

// OAuth state
let oauthState = null;

// -----------------------------
// Home
// -----------------------------
app.get("/", (req, res) => {
  res.send(`
    <h1>YT Auto SEO 🚀</h1>
    <p>Server is running successfully.</p>
    <p><a href="/auth/google">Connect YouTube with Google</a></p>
  `);
});

// -----------------------------
// Health check
// -----------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "YT Auto SEO"
  });
});

// -----------------------------
// Google OAuth start
// -----------------------------
app.get("/auth/google", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).send(
      "Google OAuth environment variables are missing."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  oauthState = crypto.randomBytes(32).toString("hex");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state: oauthState,
    scope: [
      "https://www.googleapis.com/auth/youtube"
    ]
  });

  res.redirect(authUrl);
});

// -----------------------------
// Google OAuth callback
// -----------------------------
app.get("/oauth2callback", async (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send(
        "Google OAuth environment variables are missing."
      );
    }

    if (!req.query.state || req.query.state !== oauthState) {
      return res.status(400).send("Invalid OAuth state.");
    }

    const code = req.query.code;

    if (!code) {
      return res.status(400).send("Authorization code is missing.");
    }

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens temporarily on the server
    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify(tokens),
      "utf8"
    );

    oauthState = null;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>YT Auto SEO</title>
      </head>
      <body style="font-family:Arial;text-align:center;padding:40px;">
        <h1>Google Connected Successfully ✅</h1>
        <p>Your YouTube authorization was successful.</p>
        <p>YT Auto SEO is now connected to your YouTube account.</p>
        <p>You can close this page.</p>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("OAuth Error:", error);

    res.status(500).send(`
      <h1>Google Authorization Failed ❌</h1>
      <p>Please check the Render logs.</p>
    `);
  }
});

// -----------------------------
// YouTube connection test
// -----------------------------
app.get("/api/youtube-status", async (req, res) => {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return res.json({
        connected: false,
        message: "YouTube is not connected yet."
      });
    }

    const tokens = JSON.parse(
      fs.readFileSync(TOKEN_FILE, "utf8")
    );

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client
    });

    const response = await youtube.channels.list({
      part: ["snippet"],
      mine: true
    });

    const channel = response.data.items?.[0];

    if (!channel) {
      return res.json({
        connected: false,
        message: "YouTube channel was not found."
      });
    }

    res.json({
      connected: true,
      channelName: channel.snippet.title
    });

  } catch (error) {
    console.error("YouTube Status Error:", error);

    res.status(500).json({
      connected: false,
      message: "YouTube connection test failed."
    });
  }
});

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`YT Auto SEO running on port ${PORT}`);
});    
