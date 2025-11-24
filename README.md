# DT Genie - AI Chatbot Widget System

A complete, premium AI chatbot widget for your website with a futuristic neon design. Powered by **OpenRouter's free tier** using Meta-Llama-3.1-8B-Instruct.

![DT Genie](public/avatar.png)

## 🌟 Features

- ✨ **100% Free** - Uses OpenRouter's free tier (no API costs)
- 🎨 **Premium Design** - Glass-morphism UI with neon blue/orange theme
- 🔄 **Curved Text** - Animated "We are here" text around avatar
- 🤖 **Custom Training** - Edit `knowledge.json` to train on your business
- 📱 **Fully Responsive** - Works on desktop, tablet, and mobile
- 🚀 **Easy Embed** - Add to any website with 2 lines of code
- 💬 **Context-Aware** - Maintains conversation history
- ⚡ **Fast Setup** - Get running in under 5 minutes

## 📁 File Structure

```
├── server.js              # Backend API server (Express)
├── knowledge.json         # Business knowledge/training data
├── index.html            # Demo page
├── public/
│   ├── widget.js         # Chat widget frontend
│   ├── widget.css        # Neon-themed styling
│   └── avatar.png        # Chatbot avatar image
├── package-chatbot.json  # Dependencies
└── README.md            # This file
```

## 🚀 Quick Start

### 1. Get OpenRouter API Key (Free)

1. Visit [OpenRouter.ai](https://openrouter.ai/keys)
2. Sign up for a free account
3. Create a new API key
4. Copy your API key

### 2. Configure Server

Open `server.js` and paste your API key:

```javascript
const OPENROUTER_API_KEY = 'YOUR_API_KEY_HERE';
```

Or set it as an environment variable:
```bash
export OPENROUTER_API_KEY='your_key_here'
```

### 3. Install Dependencies

```bash
npm install --package-lock-only --package-lock package-chatbot.json
npm install
```

### 4. Start the Server

```bash
node server.js
```

The server will start on `http://localhost:5000`

### 5. Test It

Open your browser and go to `http://localhost:5000` to see the demo page with the working chatbot!

## 🎨 Customization

### Change Business Knowledge

Edit `knowledge.json`:

```json
{
  "business_info": "Your business description here...",
  "services": ["Service 1", "Service 2", "Service 3"],
  "industries": ["Industry 1", "Industry 2"],
  "contact": {
    "booking_link": "https://calendly.com/yourlink",
    "instructions": "How to handle booking requests"
  }
}
```

The chatbot will automatically use this information in its responses!

### Change Colors

Edit `public/widget.css` at the top:

```css
:root {
  --neon-blue: #00E1FF;      /* Primary color */
  --neon-orange: #FF7A18;    /* Secondary color */
  --dark-bg: #0a0a0a;        /* Background */
  --glass-bg: rgba(15, 15, 25, 0.85);  /* Panel background */
}
```

### Change Avatar

Replace `public/avatar.png` with your own image (recommended: 200x200px)

### Change Curved Text

Edit `public/widget.js` around line 15:

```javascript
We are here • We are here • We are here •
```

Change to any text you want!

### Change Font

Edit `public/widget.css` at the top to change from Poppins to another Google Font

## 🌐 Embed on Your Website

Once your server is running and deployed, add these 2 lines before the closing `</body>` tag:

```html
<!-- DT Genie Chatbot Widget -->
<link rel="stylesheet" href="https://your-domain.com/widget.css">
<script src="https://your-domain.com/widget.js"></script>
```

### For Replit Deployment

If you're hosting on Replit:

```html
<link rel="stylesheet" href="https://your-replit-name.replit.app/widget.css">
<script src="https://your-replit-name.replit.app/widget.js"></script>
```

### For Other Hosting

Replace `your-domain.com` with:
- Your deployed URL (Vercel, Netlify, Heroku, etc.)
- Your custom domain
- Any server where you host `server.js`

## 🔧 API Endpoints

### POST /chat

Send a message to the chatbot:

```javascript
fetch('http://localhost:5000/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What services do you offer?",
    history: []  // Optional: previous messages for context
  })
})
```

Response:
```json
{
  "reply": "We offer social media marketing, SEO, web development...",
  "success": true
}
```

### GET /health

Check server status:

```javascript
fetch('http://localhost:5000/health')
```

Response:
```json
{
  "status": "ok",
  "knowledgeLoaded": true
}
```

## 💡 How It Works

1. **User opens chat**: Widget appears in bottom-right corner
2. **User types message**: Sent to `/chat` endpoint
3. **Server processes**:
   - Loads `knowledge.json` for business context
   - Combines with conversation history
   - Sends to OpenRouter API (free tier)
   - Returns AI-generated response
4. **Widget displays**: Shows response with smooth animations

## 🎯 System Prompt

The chatbot uses this personality (automatically generated from `knowledge.json`):

```
You are DT Genie — an AI assistant for Digital Transition Marketing.
You answer clearly, helpfully, and stay on-brand.

[Business info from knowledge.json]
[Services list]
[Industries served]
[Contact/booking information]

Provide concise, expert responses. Ask follow-up questions to better understand client needs.
```

## 🔒 Security Notes

- Never commit your API key to version control
- Use environment variables in production
- Add rate limiting if needed
- CORS is enabled by default (configure in `server.js`)

## 📊 OpenRouter Free Tier

- **Model**: Meta-Llama-3.1-8B-Instruct
- **Cost**: $0.00 (free tier)
- **Rate Limits**: Check [OpenRouter docs](https://openrouter.ai/docs)
- **Upgrade**: Available if you need higher limits

## 🐛 Troubleshooting

**Chat not responding?**
- Check if server is running: `http://localhost:5000/health`
- Verify API key is correct in `server.js`
- Check browser console for errors (F12)

**"API key not configured" error?**
- Make sure you added your API key to `server.js`
- Or set `OPENROUTER_API_KEY` environment variable

**Widget not appearing?**
- Check that `widget.css` and `widget.js` are loaded
- Open browser console (F12) to see any errors
- Verify the server is serving files from `/public`

**CORS errors?**
- CORS is enabled by default in `server.js`
- If using different domain, ensure server URL is correct

## 🚀 Deployment

### Replit (Easiest)

1. Upload all files to Replit
2. Add `OPENROUTER_API_KEY` to Secrets
3. Run `node server.js`
4. Get your `.replit.app` URL
5. Update embed code with your URL

### Other Platforms

The chatbot works on any Node.js hosting:
- Heroku
- Vercel
- Railway
- DigitalOcean
- AWS
- Your own VPS

## 📝 License

MIT License - Free to use for Digital Transition Marketing and clients

## 🤝 Support

For issues or questions:
1. Check this README
2. Review browser console errors
3. Verify server logs
4. Check OpenRouter status

---

**Built with ❤️ for Digital Transition Marketing**

*Powered by OpenRouter's Free Tier*
