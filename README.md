# PulseTCP — Multi-Client TCP Chat & Socket Telemetry

Low-latency multi-client TCP chat and real-time socket telemetry platform
powered by Python sockets and multithreading, with a React web interface.

View the app in AI Studio: https://ai.studio/apps/7a08a6dc-9cd3-4583-8734-68e881b2d364

## Run Locally

**Prerequisites:** Python 3.10+ and Node.js 20 LTS or newer.

1. Install dependencies:
   `npm install`
2. Start everything (Python TCP server on port 9090 + web UI on port 3000):
   `npm run dev`
3. Open http://localhost:3000 and log in with a demo account
   (e.g. `dev_alex` / `AlexPulse#2026`).

No API key is needed — nothing in this project calls Gemini.

Full step-by-step instructions, demo accounts, tests and troubleshooting:
see **[RUN_GUIDE.md](RUN_GUIDE.md)**.
