# Digital Transition Marketing - AI Chatbot System

A complete, **100% free** AI chatbot system for your marketing agency website, powered by HuggingFace's Meta-Llama-3.1-8B-Instruct model.

## 🚀 Features

- **Free AI Model**: Uses HuggingFace's free inference API (Meta-Llama-3.1-8B-Instruct)
- **Backend API**: Node.js/Express server with session management
- **Embeddable Widget**: Vanilla JavaScript widget that works on ANY website
- **Brand Customized**: Pre-configured with Digital Transition Marketing's voice and services
- **Lead Capture**: Collects visitor info and directs to Calendly booking
- **Mobile Responsive**: Beautiful UI that works on all devices

## 📁 Project Structure

```
/backend
  index.js           - Express server with /chat endpoint
  package.json       - Backend dependencies
  .env.example       - Environment variable template

/frontend
  widget.html        - Embeddable chat widget (copy-paste ready)

/client              - Demo website (React/Vite)
  /src/components
    ChatWidget.tsx         - React chat component
    EmbeddableWidget.tsx   - Code snippet display
    DemoPage.tsx          - Demo landing page

README.md            - This file
```

## 🔧 Setup Instructions

### 1. Get Your HuggingFace API Key

1. Go to [HuggingFace](https://huggingface.co/)
2. Sign up for a free account
3. Go to Settings → Access Tokens
4. Create a new token (read access is sufficient)
5. Copy your API key

### 2. Configure Backend

1. Navigate to the backend folder
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and paste your HuggingFace API key:
   ```
   HUGGINGFACE_API_KEY=your_api_key_here
   PORT=8080
   ```

### 3. Install Dependencies

```bash
cd backend
npm install
```

### 4. Start the Server

```bash
npm start
```

The server will start on `http://localhost:8080`

## 🎨 Customize the System Prompt

The chatbot's personality and knowledge are defined in the **system prompt**.

**Location**: `backend/index.js` (around line 20-30)

**Default Prompt**:
```javascript
const systemPrompt = `You are the AI assistant of Digital Transition Marketing.
Services: Social media marketing, content creation, SEO, SEM, AI ads, automated funnels, web development, branding, and CGI property tours.
Industries: e-commerce, technology, real estate, travel & tourism.
Voice: futuristic, helpful, expert, results-driven, friendly.
Provide concise answers, ask a follow-up question, and if user wants to book a call,
ask for Name + Email and then show my booking link: https://calendly.com/`;
```

**To Customize**:
1. Open `backend/index.js`
2. Find the `systemPrompt` variable
3. Edit the text to match your needs
4. Restart the server

## 🌐 Add Widget to Your Website

### For Framer, WordPress, or Any HTML Site

1. Start your backend server (must be running)
2. Open `frontend/widget.html`
3. Copy the entire `<script>` section
4. Paste it before the closing `</body>` tag on your website

**Or** use the demo site:
1. Run `npm run dev` from the root folder
2. Visit `http://localhost:5000`
3. Click the "Get Code" tab
4. Copy the widget code

### Widget Configuration

In `widget.html`, you can customize:

**Backend URL** (line 3):
```javascript
const BACKEND_URL = 'http://localhost:8080';  // Change to your deployed backend URL
```

**Colors** (in the `styles` section):
- Primary color: `hsl(217, 91%, 60%)` - Change to match your brand
- Message bubbles, borders, text colors

**Size**:
- Widget width: `380px` (line in styles)
- Button size: `60px × 60px` (line in styles)

## 🎯 How It Works

1. **User opens chat**: Widget sends welcome message
2. **User types message**: Sent to backend `/chat` endpoint
3. **Backend processes**:
   - Maintains conversation history per session
   - Adds system prompt + conversation to HuggingFace API
   - Returns AI response
4. **Widget displays**: Shows AI response with typing animation

## 🔄 Testing Locally

1. Start backend: `cd backend && npm start`
2. Open `frontend/widget.html` in your browser
3. Click the chat button and start chatting

## 🚀 Deploy to Production

### Backend Deployment (Replit)

1. This project is already set up for Replit
2. Add your `HUGGINGFACE_API_KEY` to Replit Secrets
3. Click "Run" - server starts automatically on port 8080
4. Copy your Replit URL (e.g., `https://your-project.replit.app`)

### Update Widget

In your widget code, change:
```javascript
const BACKEND_URL = 'https://your-project.replit.app';
```

## 💡 Customization Guide

### Change Colors

**Widget Colors** (`frontend/widget.html`):
```javascript
// Primary brand color
background: hsl(217, 91%, 60%);

// User message bubble
background: hsl(217, 91%, 60%);

// AI message bubble
background: #f3f4f6;
```

### Change Icon

Replace the SVG icons in the widget code with your own SVG or icon library.

### Change Fonts

Add your font in the `styles` section:
```javascript
font-family: 'Your Font', -apple-system, sans-serif;
```

### Modify Chat Behavior

**Conversation History Limit** (`backend/index.js`):
```javascript
// Keep last 10 messages (5 pairs)
sessions[sessionId].history = history.slice(-10);
```

## ❓ Troubleshooting

**Chat not responding?**
- Check if backend is running: `http://localhost:8080`
- Verify HuggingFace API key is correct in `.env`
- Check browser console for errors

**CORS errors?**
- Backend has CORS enabled by default
- If using different domain, verify BACKEND_URL in widget

**Rate limits?**
- HuggingFace free tier has rate limits
- Consider adding retry logic or use paid tier for production

## 📝 License

Free to use for Digital Transition Marketing and clients.

## 🤝 Support

For questions or issues, check:
1. This README
2. Console errors in browser
3. Server logs in terminal
4. HuggingFace API status

---

**Built with ❤️ for Digital Transition Marketing**
