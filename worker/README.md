# AutoHue Processing Worker

This is the image processing engine that runs separately from the Next.js frontend.

## Setup

```bash
cd worker
npm install
node server.js
```

Runs on port 3001 by default (set `PORT` env var to change).

## Deployment

Deploy this worker to a VPS or container service (Railway, Render, DigitalOcean, etc.)
that supports long-running processes and has sufficient memory for the ONNX model.

**Cannot run on Vercel** due to function size/timeout limits.

## Required Files

- `server.js` — Copy from project root
- `models/` — ONNX model directory (symlink or copy from project root)
