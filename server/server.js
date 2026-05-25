const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-3-5-haiku-latest";
const ANTHROPIC_VERSION = "2023-06-01";

app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

app.get("/api/weather", async (req, res) => {
  const city = req.query.q?.trim();

  if (!city) {
    return res.status(400).json({ error: "City query parameter is required." });
  }

  if (!hasConfiguredKey(process.env.OPENWEATHER_API_KEY)) {
    return res.status(500).json({ error: "OpenWeatherMap API key is not configured." });
  }

  try {
    const data = await fetchOpenWeather({
      q: city,
    });

    return res.json(data);
  } catch (error) {
    return sendProxyError(res, error);
  }
});

app.get("/api/weather/coords", async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Latitude and longitude query parameters are required." });
  }

  if (!hasConfiguredKey(process.env.OPENWEATHER_API_KEY)) {
    return res.status(500).json({ error: "OpenWeatherMap API key is not configured." });
  }

  try {
    const data = await fetchOpenWeather({
      lat,
      lon,
    });

    return res.json(data);
  } catch (error) {
    return sendProxyError(res, error);
  }
});

app.post("/api/summarize", async (req, res) => {
  if (!hasConfiguredKey(process.env.ANTHROPIC_API_KEY)) {
    return res.status(500).json({ error: "Anthropic API key is not configured." });
  }

  const { weather, userType, productivityScore, moodTag } = req.body;

  if (!weather || !userType || !productivityScore || !moodTag) {
    return res.status(400).json({
      error: "weather, userType, productivityScore, and moodTag are required.",
    });
  }

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 220,
        messages: [
          {
            role: "user",
            content: buildSummaryPrompt({
              weather,
              userType,
              productivityScore,
              moodTag,
            }),
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Claude summary could not be generated.",
      });
    }

    const summary = data.content
      ?.filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (!summary) {
      return res.status(502).json({ error: "Claude returned an empty summary." });
    }

    return res.json({ summary });
  } catch (error) {
    return res.status(502).json({
      error: "Failed to reach Anthropic. Please try again later.",
      details: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`RealWeather proxy server running on http://localhost:${port}`);
});

async function fetchOpenWeather(params) {
  const url = new URL(OPENWEATHER_BASE_URL);
  url.search = new URLSearchParams({
    ...params,
    appid: process.env.OPENWEATHER_API_KEY,
    units: "metric",
  });

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "OpenWeatherMap request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

function buildSummaryPrompt({ weather, userType, productivityScore, moodTag }) {
  return `Write a 3-4 sentence conversational day summary for this weather app user.
Tone: friendly, practical, and motivating, not robotic.
Do not use bullet points.

Weather data:
- City and country: ${weather.city}, ${weather.country}
- Temperature: ${weather.temperature} deg C
- Feels like: ${weather.feelsLike} deg C
- Weather condition: ${weather.condition}
- Weather description: ${weather.description}
- Humidity: ${weather.humidity}%
- Wind speed: ${weather.windSpeedKmh} km/h
- Selected user type: ${userType}
- Productivity score: ${productivityScore}
- Mood tag: ${moodTag}`;
}

function sendProxyError(res, error) {
  const status = error.status || 502;

  return res.status(status).json({
    error: error.message || "Proxy request failed.",
  });
}

function hasConfiguredKey(value) {
  return value && value !== "your_key_here";
}

