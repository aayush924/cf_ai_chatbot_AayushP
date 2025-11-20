# 🚀 Deployment Guide

Complete guide to deploying your AI chat application to Cloudflare.

## Prerequisites

- ✅ Cloudflare account (sign up at [cloudflare.com](https://cloudflare.com))
- ✅ Wrangler CLI installed (`npm install -g wrangler` or use local)
- ✅ Workers AI enabled (available on all plans)

## Step-by-Step Deployment

### 1. Login to Cloudflare

```bash
npx wrangler login
```

This opens your browser to authenticate with Cloudflare.

### 2. Verify Configuration

Check `wrangler.jsonc`:

```jsonc
{
  "name": "cf-ai-app",  // Your Worker name
  "main": "src/index.ts",
  "ai": { "binding": "AI" },
  "durable_objects": {
    "bindings": [{
      "name": "CHAT_SESSIONS",
      "class_name": "ChatSession",
      "script_name": "cf-ai-app"  // Must match "name" above
    }]
  },
  "assets": {
    "directory": "./public/"
  }
}
```

### 3. Deploy to Production

```bash
npm run deploy
```

**Expected output:**
```
 ⛅️ wrangler 4.x.x
─────────────────────
Your worker has been deployed!
✨ https://cf-ai-app.YOUR-SUBDOMAIN.workers.dev

Durable Objects:
  ChatSession - migrated successfully
```

### 4. Update Frontend Configuration

Edit `public/app.js` line 5:

```javascript
const WORKER_URL = window.location.hostname === 'localhost' 
	? 'http://localhost:8787'
	: 'https://cf-ai-app.YOUR-SUBDOMAIN.workers.dev'; // ⬅️ UPDATE THIS
```

Replace `YOUR-SUBDOMAIN` with your actual Cloudflare Workers subdomain.

### 5. Redeploy with Updated Config

```bash
npm run deploy
```

### 6. Test Your Deployment

Visit your Worker URL:
```
https://cf-ai-app.YOUR-SUBDOMAIN.workers.dev
```

You should see the chat interface!

## Deployment Checklist

- [ ] Logged into Wrangler
- [ ] Worker name configured in `wrangler.jsonc`
- [ ] First deployment successful
- [ ] Worker URL obtained
- [ ] `WORKER_URL` updated in `public/app.js`
- [ ] Redeployed with new configuration
- [ ] Tested chat functionality
- [ ] Tested voice input
- [ ] WebSocket connection working

## Troubleshooting Deployment

### Error: "Durable Object binding not found"

**Solution**: Deploy creates the binding automatically. If error persists:

```bash
# Check migrations
npx wrangler migrations list

# Should show:
# ✓ v1: new_classes: ["ChatSession"]
```

### Error: "AI binding not available"

**Solution**: Workers AI is available on all plans. Ensure you're logged in:

```bash
npx wrangler whoami
# Should show your account email
```

### Error: "Static assets not found"

**Solution**: Verify `public/` directory exists with files:
```bash
ls public/
# Should show: index.html  styles.css  app.js
```

### WebSocket Connection Fails in Production

**Cause**: `WORKER_URL` not updated in `app.js`

**Solution**: 
1. Update `WORKER_URL` in `public/app.js`
2. Redeploy: `npm run deploy`

### CORS Errors

Already handled in Worker with:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

If still seeing errors, check browser console for specific issue.

## Advanced Deployment

### Custom Domain

1. Add domain in Cloudflare Dashboard
2. Go to Workers & Pages → cf-ai-app → Settings → Triggers
3. Add custom domain
4. Update `WORKER_URL` in `app.js`

### Environment Variables

Add secrets for production:

```bash
npx wrangler secret put OPENAI_API_KEY
# (if using external APIs)
```

### Multiple Environments

Create `wrangler.prod.jsonc`:

```jsonc
{
  "name": "cf-ai-app-prod",
  // ... other config
}
```

Deploy:
```bash
npx wrangler deploy --config wrangler.prod.jsonc
```

## Monitoring & Logs

### View Live Logs

```bash
npx wrangler tail
```

Shows real-time logs from your Worker.

### Analytics Dashboard

Visit Cloudflare Dashboard:
- Workers & Pages → cf-ai-app → Metrics
- View requests, errors, duration
- Workers AI usage statistics

### Error Tracking

Check Logs section in Dashboard for:
- JavaScript errors
- AI model failures
- WebSocket issues
- Durable Object errors

## Cost Estimation

### Free Tier Limits
- **Workers requests**: 100,000/day
- **Durable Objects**: 100,000 reads + 1,000 writes/day
- **Workers AI**: 10,000 neurons/day (varies by model)

### Paid Plans
- **Workers**: $5/month + $0.50/million requests
- **Durable Objects**: $5/month + usage-based
- **Workers AI**: Pay-as-you-go beyond free tier

### Typical Usage (Free Tier)
This app can handle:
- ~1,000 chat conversations/day
- ~500 voice transcriptions/day
- Unlimited WebSocket connections (while within request limits)

## Production Best Practices

### 1. Rate Limiting

Add to Worker:
```typescript
// Track requests per session
const RATE_LIMIT = 100; // per hour
```

### 2. Error Handling

Already implemented:
- Try-catch blocks on all API calls
- User-friendly error messages
- Detailed console logging

### 3. Monitoring

Set up alerts in Cloudflare Dashboard:
- Error rate > 5%
- Response time > 1000ms
- AI quota approaching limit

### 4. Caching

Static assets automatically cached via Pages.

For API responses, add:
```typescript
return new Response(data, {
  headers: {
    'Cache-Control': 'public, max-age=60'
  }
});
```

### 5. Security

- Enable bot management in Dashboard
- Add rate limiting per IP
- Implement user authentication (optional)
- Use HTTPS only (automatic with Workers)

## Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Add `CLOUDFLARE_API_TOKEN` in GitHub repository secrets.

## Rollback

### Revert to Previous Version

```bash
# View deployments
npx wrangler deployments list

# Rollback to specific deployment
npx wrangler rollback --message "Rollback to stable"
```

## Performance Optimization

### Enable Smart Placement

In `wrangler.jsonc`:
```jsonc
{
  "placement": { "mode": "smart" }
}
```

Automatically routes requests to optimal locations.

### Optimize Assets

```bash
# Minify CSS/JS before deployment
npm install -D cssnano uglify-js
```

## Scaling

### Horizontal Scaling
✅ **Automatic** - Cloudflare scales automatically

### Durable Object Scaling
- One instance per session ID
- Automatically created on demand
- Isolated per user

### Workers AI Scaling
- Shared GPU resources
- Queued during high load
- Consider batch processing for high volume

## Support

### Get Help
- [Cloudflare Community Discord](https://discord.gg/cloudflaredev)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Community Forum](https://community.cloudflare.com/)

### Debugging Commands

```bash
# Check deployment status
npx wrangler deployments list

# View live logs
npx wrangler tail

# Check Durable Object migrations
npx wrangler migrations list

# Validate configuration
npx wrangler deploy --dry-run
```

## What's Deployed?

After successful deployment, you have:

✅ Cloudflare Worker running your API
✅ Durable Object class (ChatSession) for state
✅ Static assets served from edge
✅ Workers AI models accessible
✅ WebSocket connections supported
✅ Global CDN distribution
✅ Automatic HTTPS
✅ DDoS protection

## Next Steps

1. ✅ Share your app URL
2. 🎨 Customize the UI
3. 📊 Monitor usage in Dashboard
4. 🚀 Add custom domain
5. 🔐 Implement authentication
6. 📈 Scale as needed

---

**Your AI chat app is now live on the edge!** 🎉

Questions? Check [Cloudflare Docs](https://developers.cloudflare.com) or join the [Discord community](https://discord.gg/cloudflaredev).

