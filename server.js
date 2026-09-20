const express = require("express");
const { google } = require("googleapis");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

app.get("/", (req, res) => {
  res.send(`
    <h1>YT Auto SEO</h1>
    <p>Server is running successfully.</p>
    <p>Google OAuth is ready to be connected.</p>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "YT Auto SEO"
  });
});

app.get("/auth/google", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).send("Google OAuth settings are not configured yet.");
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

app.get("/oauth2callback", async (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send("Google OAuth settings are not configured yet.");
    }

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Authorization code is missing.");
    }

    const { tokens } = await oauth2Client.getToken(code);

    res.json({
      message: "YouTube authorization successful.",
      note: "Tokens were received successfully.",
      hasRefreshToken: !!tokens.refresh_token
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Google authorization failed.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`YT Auto SEO server running on port ${PORT}`);
});
