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

const TOKEN_FILE = path.join("/tmp", "youtube-token.json");

// Create a secure OAuth state from the secret.
// This avoids the previous "Invalid OAuth state" problem.
function createOAuthState() {
  return crypto
    .createHash("sha256")
    .update(CLIENT_SECRET || "")
    .digest("hex");
}

// -----------------------------
// Home
// -----------------------------
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>YT Auto SEO</title>
      </head>
      <body style="font-family:Arial;text-align:center;padding:40px;">
        <h1>YT Auto SEO 🚀</h1>
        <p>Server is running successfully.</p>
        <p>
          <a href="/auth/google">
            Connect YouTube with Google
          </a>
        </p>
      </body>
    </html>
  `);
});

// -----------------------------
// Health
// -----------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "YT Auto SEO"
  });
});

// -----------------------------
// Start Google OAuth
// -----------------------------
app.get("/auth/google", (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send(
        "Google OAuth settings are missing in Render."
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const state = createOAuthState();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      state: state,
      scope: [
        "https://www.googleapis.com/auth/youtube"
      ]
    });

    res.redirect(authUrl);

  } catch (error) {
    console.error("OAuth Start Error:", error);
    res.status(500).send("Unable to start Google authorization.");
  }
});

// -----------------------------
// Google OAuth Callback
// -----------------------------
app.get("/oauth2callback", async (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send(
        "Google OAuth settings are missing in Render."
      );
    }

    const expectedState = createOAuthState();

    if (req.query.state !== expectedState) {
      return res.status(400).send("Invalid OAuth state.");
    }

    if (!req.query.code) {
      return res.status(400).send(
        "Authorization code is missing."
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(
      req.query.code
    );

    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify(tokens),
      "utf8"
    );

    console.log("YouTube OAuth tokens received successfully.");

    res.send(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>YT Auto SEO</title>
        </head>
        <body style="font-family:Arial;text-align:center;padding:40px;">
          <h1>Google Connected Successfully ✅</h1>
          <p>YouTube authorization was successful.</p>
          <p>YT Auto SEO is now connected to your YouTube account.</p>
          <p>You can close this page.</p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error("OAuth Callback Error:", error);

    res.status(500).send(`
      <html>
        <body style="font-family:Arial;text-align:center;padding:40px;">
          <h1>Google Authorization Failed ❌</h1>
          <p>Please check the Render logs.</p>
        </body>
      </html>
    `);
  }
});

// -----------------------------
// YouTube Connection Test
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
        message: "YouTube channel not found."
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
// Start Server
// -----------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `YT Auto SEO server running on port ${PORT}`
  );
});
