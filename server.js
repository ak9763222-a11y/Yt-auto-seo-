const express = require("express");
const { google } = require("googleapis");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const TOKEN_FILE = path.join("/tmp", "youtube-token.json");


// ===============================
// Google OAuth State
// ===============================

function createState() {
  const random = crypto.randomBytes(32).toString("hex");

  const signature = crypto
    .createHmac("sha256", CLIENT_SECRET || "secret")
    .update(random)
    .digest("hex");

  return `${random}.${signature}`;
}


function verifyState(state) {
  try {
    if (!state || !state.includes(".")) {
      return false;
    }

    const parts = state.split(".");

    if (parts.length !== 2) {
      return false;
    }

    const random = parts[0];
    const signature = parts[1];

    const expected = crypto
      .createHmac("sha256", CLIENT_SECRET || "secret")
      .update(random)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );

  } catch {
    return false;
  }
}


// ===============================
// HOME
// ===============================

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

        <br>

        <a href="/auth/google"
           style="
           display:inline-block;
           padding:15px 25px;
           background:#4285f4;
           color:white;
           text-decoration:none;
           border-radius:8px;">
           Connect YouTube
        </a>

      </body>
    </html>
  `);
});


// ===============================
// HEALTH CHECK
// ===============================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "YT Auto SEO"
  });
});


// ===============================
// GOOGLE LOGIN
// ===============================

app.get("/auth/google", (req, res) => {

  try {

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send(
        "Google OAuth Environment Variables are missing."
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const state = createState();

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

    res.status(500).send(
      "Unable to start Google authorization."
    );

  }

});


// ===============================
// GOOGLE CALLBACK
// ===============================

app.get("/oauth2callback", async (req, res) => {

  try {

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {

      return res.status(500).send(
        "Google OAuth Environment Variables are missing."
      );

    }


    // Check OAuth state

    if (!verifyState(req.query.state)) {

      return res.status(400).send(`
        <h2>Invalid OAuth state ❌</h2>
        <p>Please start Google connection again.</p>
      `);

    }


    // Check authorization code

    if (!req.query.code) {

      return res.status(400).send(`
        <h2>Authorization code missing ❌</h2>
      `);

    }


    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );


    // Get tokens

    const result = await oauth2Client.getToken(
      req.query.code
    );

    const tokens = result.tokens;


    if (!tokens || !tokens.access_token) {

      return res.status(400).send(`
        <h2>Google token was not received ❌</h2>
      `);

    }


    // Save token temporarily

    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify(tokens),
      "utf8"
    );


    console.log(
      "Google OAuth tokens saved successfully."
    );


    res.send(`
      <html>

        <head>
          <meta name="viewport"
                content="width=device-width, initial-scale=1">
          <title>YT Auto SEO</title>
        </head>

        <body style="
          font-family:Arial;
          text-align:center;
          padding:40px;
        ">

          <h1>Google Connected Successfully ✅</h1>

          <p>
            YouTube authorization was successful.
          </p>

          <p>
            YT Auto SEO is now connected to your YouTube account.
          </p>

          <br>

          <p>
            You can close this page.
          </p>

        </body>

      </html>
    `);

  } catch (error) {

    console.error(
      "Google OAuth Callback Error:",
      error
    );


    // IMPORTANT:
    // Never save a bad/invalid token

    try {

      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }

    } catch {}


    res.status(400).send(`
      <html>

        <body style="
          font-family:Arial;
          text-align:center;
          padding:40px;
        ">

          <h2>Google Authorization Failed ❌</h2>

          <p>
            Please start Google connection again.
          </p>

          <p>
            Error: invalid or expired authorization.
          </p>

        </body>

      </html>
    `);

  }

});


// ===============================
// YOUTUBE CONNECTION TEST
// ===============================

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

    console.error(
      "YouTube Status Error:",
      error
    );


    // If Google says invalid_grant,
    // remove the bad token.

    if (
      error.response &&
      error.response.data &&
      error.response.data.error === "invalid_grant"
    ) {

      try {

        if (fs.existsSync(TOKEN_FILE)) {
          fs.unlinkSync(TOKEN_FILE);
        }

      } catch {}


      return res.status(401).json({

        connected: false,

        message:
          "Google authorization expired. Please connect Google again."

      });

    }


    res.status(500).json({

      connected: false,

      message: "YouTube connection test failed."

    });

  }

});


// ===============================
// START SERVER
// ===============================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `YT Auto SEO running on port ${PORT}`
    );

  }
);
