# 🤖 AI Chat with Voice

A production-ready AI chat application built on Cloudflare's edge infrastructure with voice input and conversational AI.

## ✨ Features

- **🧠 Llama 3.3 70B** - Advanced conversational AI via Workers AI
- **🎤 Voice Input** - Whisper AI for speech-to-text transcription
- **💬 Real-Time** - WebSockets via Durable Objects
- **💾 Memory** - Persistent conversation history
- **🎨 Dark UI** - Minimal, modern design

## 🏗️ Tech Stack

**100% Cloudflare:**
- Cloudflare Pages (frontend)
- Cloudflare Workers (API)
- Durable Objects + WebSockets (state & real-time)
- Workers AI: Llama 3.3 (chat) + Whisper (voice)

## 📋 Prerequisites

- **Node.js** 16 or higher
- **npm** (comes with Node.js)
- **Cloudflare account** (free tier works!)
- **Wrangler CLI** (installed automatically with npm install)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd cf-ai-app
npm install
```

This installs:
- `wrangler` - Cloudflare Workers CLI
- `typescript` - Type checking
- `vitest` - Testing framework
- `@cloudflare/vitest-pool-workers` - Testing utilities

### 2. Run Development Server

```bash
npm run dev
```

This starts the local development server at **http://localhost:8787**

### 3. Open in Browser

Visit `http://localhost:8787` and start chatting!

## 📦 Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start local development server |
| `npm start` | Alias for `npm run dev` |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run cf-typegen` | Regenerate TypeScript types |
| `npm test` | Run tests (if configured) |

## 💬 How to Use

### Text Chat
1. Type your message
2. Press Enter or click **Send**
3. AI responds with context

### Voice Chat 🎤
1. Click the **microphone icon**
2. Allow microphone access
3. Speak your message
4. Click microphone again to stop
5. Transcribed text appears in input
6. Click **Send**

### Clear History
- Click **Clear Chat** button in header

## 🌐 Deployment

### Deploy to Production

```bash
npm run deploy
```

After deployment:
1. Note your Worker URL: `https://cf-ai-app.YOUR-SUBDOMAIN.workers.dev`
2. Update `WORKER_URL` in `public/app.js` (line 5)
3. Deploy again: `npm run deploy`

Your app is now live! 🎉

### First-Time Deployment

If it's your first deployment, you'll need to:

```bash
# Login to Cloudflare
npx wrangler login

# Deploy
npm run deploy
```

## 📁 Project Structure

```
cf-ai-app/
├── public/              # Frontend (Cloudflare Pages)
│   ├── index.html      # Main UI
│   ├── styles.css      # Dark theme styles
│   └── app.js          # Client-side logic
├── src/
│   └── index.ts        # Worker + Durable Objects
├── wrangler.jsonc      # Cloudflare config
├── package.json        # Dependencies & scripts
└── README.md          # This file
```

## 🔧 Configuration

### Worker URL (Production)

After deploying, update `public/app.js`:

```javascript
const WORKER_URL = window.location.hostname === 'localhost' 
	? 'http://localhost:8787'
	: 'https://cf-ai-app.YOUR-SUBDOMAIN.workers.dev'; // ⬅️ Update this
```

### AI Models

Edit `src/index.ts` to change models:

```typescript
// Chat model
await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {...})

// Voice transcription model
await env.AI.run('@cf/openai/whisper', {...})
```

View all models: [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill process on port 8787
lsof -ti:8787 | xargs kill -9
npm run dev
```

### Voice not working
- Use Chrome, Edge, or Safari (Firefox doesn't support MediaRecorder fully)
- Allow microphone permissions
- Must use HTTPS or localhost

### WebSocket connection fails
- Check `WORKER_URL` in `public/app.js`
- Ensure Worker is deployed
- Check browser console for errors

### Deployment errors
```bash
# Check you're logged in
npx wrangler whoami

# Regenerate types
npm run cf-typegen

# Try deploying again
npm run deploy
```

## 📊 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Serve frontend |
| `/ws` | WebSocket | Real-time connection |
| `/api/chat` | POST | Send message to AI |
| `/api/transcribe` | POST | Transcribe voice to text |
| `/api/history` | GET | Get conversation history |
| `/api/clear` | POST | Clear chat history |

## ✅ Requirements Satisfied

| Requirement | Implementation |
|------------|----------------|
| **LLM** | ✅ Llama 3.3 on Workers AI |
| **Workflow** | ✅ Workers + Durable Objects |
| **User Input (Chat)** | ✅ Cloudflare Pages |
| **User Input (Voice)** | ✅ WebSockets + Whisper |
| **Memory/State** | ✅ Durable Objects |

## 📚 Additional Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture details
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)

## 🎨 Customization

### Change Theme Colors

Edit `public/styles.css`:
- Background: `#0a0a0a`
- Container: `#1a1a1a`
- Borders: `#2a2a2a`, `#3a3a3a`
- Text: `#ffffff`, `#e0e0e0`

### Adjust History Length

Edit `src/index.ts` (line ~38):
```typescript
if (this.messages.length > 20) {  // Change 20 to your preferred limit
  this.messages = this.messages.slice(-20);
}
```

### Modify System Prompt

Edit `src/index.ts` (chat endpoint):
```typescript
{
  role: 'system',
  content: 'Your custom prompt here...'
}
```

## 💰 Cost

### Free Tier (Sufficient for Development)
- Workers: 100,000 requests/day
- Durable Objects: 100,000 reads + 1,000 writes/day
- Workers AI: 10,000 neurons/day

### Typical Usage
- ~1,000 chat conversations/day
- ~500 voice transcriptions/day
- Unlimited WebSocket connections (within request limits)

## 🔐 Security

- ✅ HTTPS automatic (Cloudflare)
- ✅ Audio processed on Cloudflare edge (not third-party)
- ✅ No audio storage (transcription only)
- ✅ Session-based isolation
- ✅ DDoS protection (Cloudflare)

## 📝 License

Open source - use freely!

## 🆘 Support

- [Cloudflare Community Discord](https://discord.gg/cloudflaredev)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Community Forum](https://community.cloudflare.com/)

---

**Built with Cloudflare Workers • Durable Objects • Workers AI**
