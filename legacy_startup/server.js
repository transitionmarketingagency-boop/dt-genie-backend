const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ========================================
// INSERT YOUR OPENROUTER API KEY HERE
// ========================================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'YOUR_OPENROUTER_API_KEY_HERE';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load knowledge base
let knowledgeBase = {};
try {
  const knowledgeData = fs.readFileSync('knowledge.json', 'utf8');
  knowledgeBase = JSON.parse(knowledgeData);
  console.log('✓ Knowledge base loaded successfully');
} catch (error) {
  console.error('✗ Error loading knowledge.json:', error.message);
  knowledgeBase = {
    business_info: "Digital Transition Marketing - helping brands transition to the digital future."
  };
}

// Build system prompt from knowledge base
function buildSystemPrompt() {
  const businessInfo = knowledgeBase.business_info || '';
  const services = knowledgeBase.services ? `\n\nServices: ${knowledgeBase.services.join(', ')}` : '';
  const industries = knowledgeBase.industries ? `\n\nIndustries we serve: ${knowledgeBase.industries.join(', ')}` : '';
  
  let contactInfo = '';
  if (knowledgeBase.contact) {
    contactInfo = `\n\nBooking: ${knowledgeBase.contact.instructions || ''}`;
    if (knowledgeBase.contact.booking_link) {
      contactInfo += ` Link: ${knowledgeBase.contact.booking_link}`;
    }
  }
  
  return `You are DT Genie — an AI assistant for Digital Transition Marketing. 
You answer clearly, helpfully, and stay on-brand.

${businessInfo}${services}${industries}${contactInfo}

Provide concise, expert responses. Ask follow-up questions to better understand client needs.`;
}

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY_HERE') {
      return res.status(500).json({ 
        error: 'OpenRouter API key not configured. Please add your API key in server.js or set OPENROUTER_API_KEY environment variable.' 
      });
    }

    // Build messages array
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...history.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    console.log(`📨 Sending message to OpenRouter...`);

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://digitaltransition.marketing',
        'X-Title': 'DT Genie Chatbot'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const assistantReply = data.choices?.[0]?.message?.content || 'I apologize, but I had trouble generating a response. Please try again.';

    console.log('✓ Response received');

    res.json({ 
      reply: assistantReply,
      success: true
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    knowledgeLoaded: Object.keys(knowledgeBase).length > 0
  });
});

// Serve demo page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 DT Genie Chatbot Server Running`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY_HERE' ? '❌ NOT SET' : '✓ Configured'}\n`);
});
