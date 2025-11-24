import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

// Inline widget CSS
const WIDGET_CSS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

:root {
  --neon-blue: #00E1FF;
  --neon-orange: #FF7A18;
  --dark-bg: #0a0a0a;
  --glass-bg: rgba(15, 15, 25, 0.85);
  --glass-border: rgba(255, 255, 255, 0.1);
}

#dt-genie-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999999;
  font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
}

#dt-genie-button {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
  border: 2px solid var(--neon-blue);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(0, 225, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible;
}

#dt-genie-button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 40px rgba(0, 225, 255, 0.6), 0 0 60px rgba(0, 225, 255, 0.3), 0 12px 40px rgba(0, 0, 0, 0.5);
  border-color: var(--neon-orange);
}

#dt-genie-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  position: relative;
  z-index: 2;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

#dt-genie-curved-text {
  position: absolute;
  width: 140px;
  height: 140px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: rotate 20s linear infinite;
}

@keyframes rotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

#dt-genie-curved-text text {
  fill: var(--neon-blue);
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 6px;
  text-transform: uppercase;
}

#dt-genie-button:hover #dt-genie-curved-text text {
  fill: var(--neon-orange);
}

#dt-genie-panel {
  position: fixed;
  bottom: 120px;
  right: 24px;
  width: 420px;
  max-width: calc(100vw - 48px);
  height: 650px;
  max-height: calc(100vh - 150px);
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid var(--glass-border);
  box-shadow: 0 0 40px rgba(0, 225, 255, 0.15), 0 20px 60px rgba(0, 0, 0, 0.5);
  display: none;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

#dt-genie-panel.open {
  display: flex;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

#dt-genie-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.2);
  background: linear-gradient(135deg, rgba(0, 225, 255, 0.05) 0%, rgba(255, 122, 24, 0.05) 100%);
}

#dt-genie-header-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--neon-blue);
  box-shadow: 0 0 15px rgba(0, 225, 255, 0.4);
}

#dt-genie-header-info {
  flex: 1;
}

#dt-genie-header-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 4px 0;
  text-shadow: 0 0 10px rgba(0, 225, 255, 0.5);
}

#dt-genie-header-status {
  font-size: 12px;
  color: var(--neon-blue);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

#dt-genie-header-status::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--neon-blue);
  box-shadow: 0 0 8px var(--neon-blue);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

#dt-genie-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  font-size: 20px;
}

#dt-genie-close:hover {
  background: rgba(255, 122, 24, 0.2);
  border-color: var(--neon-orange);
  color: var(--neon-orange);
  transform: rotate(90deg);
}

#dt-genie-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

#dt-genie-messages::-webkit-scrollbar {
  width: 6px;
}

#dt-genie-messages::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

#dt-genie-messages::-webkit-scrollbar-thumb {
  background: var(--neon-blue);
  border-radius: 10px;
}

.dt-message {
  display: flex;
  gap: 10px;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dt-message.user {
  justify-content: flex-end;
}

.dt-message-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
  position: relative;
  color: #fff;
}

.dt-message.assistant .dt-message-bubble {
  background: rgba(0, 225, 255, 0.1);
  border: 1px solid rgba(0, 225, 255, 0.3);
  border-bottom-left-radius: 4px;
  box-shadow: 0 0 20px rgba(0, 225, 255, 0.1), inset 0 0 20px rgba(0, 225, 255, 0.05);
}

.dt-message.user .dt-message-bubble {
  background: rgba(255, 122, 24, 0.15);
  border: 1px solid rgba(255, 122, 24, 0.4);
  border-bottom-right-radius: 4px;
  box-shadow: 0 0 20px rgba(255, 122, 24, 0.1), inset 0 0 20px rgba(255, 122, 24, 0.05);
}

.dt-typing {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
}

.dt-typing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--neon-blue);
  animation: typingBounce 1.4s infinite;
  box-shadow: 0 0 8px var(--neon-blue);
}

.dt-typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dt-typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingBounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 1;
  }
  30% {
    transform: translateY(-10px);
    opacity: 0.7;
  }
}

#dt-genie-input-container {
  padding: 20px;
  border-top: 1px solid rgba(0, 225, 255, 0.2);
  background: linear-gradient(180deg, rgba(0, 225, 255, 0.02) 0%, rgba(0, 0, 0, 0.3) 100%);
}

#dt-genie-input-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

#dt-genie-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 225, 255, 0.3);
  border-radius: 24px;
  padding: 12px 18px;
  color: #fff;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
  resize: none;
  max-height: 120px;
  min-height: 44px;
}

#dt-genie-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

#dt-genie-input:focus {
  border-color: var(--neon-blue);
  box-shadow: 0 0 20px rgba(0, 225, 255, 0.2), inset 0 0 10px rgba(0, 225, 255, 0.05);
}

#dt-genie-send {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--neon-blue) 0%, var(--neon-orange) 100%);
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  box-shadow: 0 0 20px rgba(0, 225, 255, 0.4);
  flex-shrink: 0;
}

#dt-genie-send:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(0, 225, 255, 0.6), 0 0 50px rgba(255, 122, 24, 0.4);
}

#dt-genie-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

#dt-genie-send svg {
  width: 20px;
  height: 20px;
}

@media (max-width: 768px) {
  #dt-genie-widget {
    bottom: 16px;
    right: 16px;
  }
  
  #dt-genie-button {
    width: 70px;
    height: 70px;
  }
  
  #dt-genie-avatar {
    width: 48px;
    height: 48px;
  }
  
  #dt-genie-panel {
    bottom: 100px;
    right: 16px;
    width: calc(100vw - 32px);
    height: calc(100vh - 130px);
  }
}`;

export default function WidgetDemo() {
  const [copied, setCopied] = useState(false);
  const [copiedFramer, setCopiedFramer] = useState(false);

  const embedCode = `<!-- DT Genie Chatbot Widget -->
<link rel="stylesheet" href="https://your-replit-url.replit.app/widget.css">
<script src="https://your-replit-url.replit.app/widget.js"></script>`;

  const framerCode = `<link rel="stylesheet" href="https://your-replit-url.replit.app/widget.css">
<script src="https://your-replit-url.replit.app/widget.js"></script>`;

  const handleCopy = async (text: string, setFunc: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFunc(true);
      setTimeout(() => setFunc(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  useEffect(() => {
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);

    // Initialize widget
    const widgetScript = `
      (function() {
        'use strict';

        const CONFIG = {
          apiEndpoint: '/api/chat',
          avatarUrl: '/avatar.png',
        };

        let messageHistory = [];
        let isOpen = false;
        let isProcessing = false;
        let sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        function createWidget() {
          const widgetHTML = \`
            <div id="dt-genie-widget">
              <div id="dt-genie-button" role="button" aria-label="Open DT Genie Chat" tabindex="0">
                <img id="dt-genie-avatar" src="\${CONFIG.avatarUrl}" alt="DT Genie" />
                <svg id="dt-genie-curved-text" viewBox="0 0 140 140">
                  <defs>
                    <path id="circlePath" d="M 70, 70 m -60, 0 a 60,60 0 1,1 120,0 a 60,60 0 1,1 -120,0" />
                  </defs>
                  <text>
                    <textPath href="#circlePath" startOffset="0%">
                      We are here • We are here • We are here •
                    </textPath>
                  </text>
                </svg>
              </div>

              <div id="dt-genie-panel" role="dialog" aria-label="DT Genie Chat">
                <div id="dt-genie-header">
                  <img id="dt-genie-header-avatar" src="\${CONFIG.avatarUrl}" alt="DT Genie" />
                  <div id="dt-genie-header-info">
                    <h3 id="dt-genie-header-name">DT Genie</h3>
                    <p id="dt-genie-header-status">Online</p>
                  </div>
                  <button id="dt-genie-close" aria-label="Close chat">×</button>
                </div>
                <div id="dt-genie-messages" role="log" aria-live="polite"></div>
                <div id="dt-genie-input-container">
                  <div id="dt-genie-input-wrapper">
                    <textarea id="dt-genie-input" placeholder="Type your message..." rows="1" aria-label="Message input"></textarea>
                    <button id="dt-genie-send" aria-label="Send message">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          \`;
          document.body.insertAdjacentHTML('beforeend', widgetHTML);
        }

        function addMessage(role, content) {
          const messagesContainer = document.getElementById('dt-genie-messages');
          const messageDiv = document.createElement('div');
          messageDiv.className = \`dt-message \${role}\`;
          const bubbleDiv = document.createElement('div');
          bubbleDiv.className = 'dt-message-bubble';
          bubbleDiv.textContent = content;
          messageDiv.appendChild(bubbleDiv);
          messagesContainer.appendChild(messageDiv);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function showTyping() {
          const messagesContainer = document.getElementById('dt-genie-messages');
          const typingDiv = document.createElement('div');
          typingDiv.id = 'dt-genie-typing';
          typingDiv.className = 'dt-message assistant';
          typingDiv.innerHTML = '<div class="dt-message-bubble"><div class="dt-typing"><div class="dt-typing-dot"></div><div class="dt-typing-dot"></div><div class="dt-typing-dot"></div></div></div>';
          messagesContainer.appendChild(typingDiv);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function hideTyping() {
          const typingDiv = document.getElementById('dt-genie-typing');
          if (typingDiv) typingDiv.remove();
        }

        async function sendMessage(message) {
          if (!message.trim() || isProcessing) return;
          isProcessing = true;
          const sendButton = document.getElementById('dt-genie-send');
          sendButton.disabled = true;
          addMessage('user', message);
          const input = document.getElementById('dt-genie-input');
          input.value = '';
          input.style.height = 'auto';
          showTyping();
          try {
            const response = await fetch(CONFIG.apiEndpoint, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({message: message, sessionId: sessionId})
            });
            if (!response.ok) throw new Error(\`Server error: \${response.status}\`);
            const data = await response.json();
            hideTyping();
            if (data.reply) addMessage('assistant', data.reply);
          } catch (error) {
            console.error('Chat error:', error);
            hideTyping();
            addMessage('assistant', 'Sorry, I\\'m having trouble connecting. Please try again.');
          } finally {
            isProcessing = false;
            sendButton.disabled = false;
            input.focus();
          }
        }

        function togglePanel(open) {
          const panel = document.getElementById('dt-genie-panel');
          const button = document.getElementById('dt-genie-button');
          isOpen = open !== undefined ? open : !isOpen;
          if (isOpen) {
            panel.classList.add('open');
            button.style.display = 'none';
            const messagesContainer = document.getElementById('dt-genie-messages');
            if (messagesContainer.children.length === 0) {
              addMessage('assistant', 'Hello! I\\'m DT Genie, your AI assistant. How can I help?');
            }
            setTimeout(() => document.getElementById('dt-genie-input').focus(), 100);
          } else {
            panel.classList.remove('open');
            button.style.display = 'flex';
          }
        }

        function autoResizeTextarea(textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }

        function init() {
          createWidget();
          const button = document.getElementById('dt-genie-button');
          const closeBtn = document.getElementById('dt-genie-close');
          const sendBtn = document.getElementById('dt-genie-send');
          const input = document.getElementById('dt-genie-input');
          button.addEventListener('click', () => togglePanel(true));
          button.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              togglePanel(true);
            }
          });
          closeBtn.addEventListener('click', () => togglePanel(false));
          sendBtn.addEventListener('click', () => sendMessage(input.value));
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input.value);
            }
          });
          input.addEventListener('input', () => autoResizeTextarea(input));
          console.log('✨ DT Genie widget loaded');
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
        } else {
          init();
        }
      })();
    `;

    const script = document.createElement('script');
    script.textContent = widgetScript;
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(style);
      document.body.removeChild(script);
      const widget = document.getElementById('dt-genie-widget');
      if (widget) widget.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <Badge className="mb-4">
            <span className="mr-2">✨</span>
            DT Genie Widget Live
          </Badge>
          <h1 className="text-4xl font-bold mb-4">AI Chatbot Widget</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Click the neon button in the bottom-right corner to chat!
          </p>
        </div>

        {/* Demo Section */}
        <Card className="p-8 mb-12 bg-muted/30">
          <h2 className="text-2xl font-bold mb-4">Try It Now</h2>
          <p className="text-muted-foreground mb-6">
            Look for the floating DT Genie button with "We are here" curved text in the bottom-right corner.
          </p>
          <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">👉</div>
            <p className="text-lg font-medium">Widget appears in bottom-right</p>
          </div>
        </Card>

        {/* Framer Integration */}
        <Card className="p-8 mb-8 border-primary/20">
          <h2 className="text-2xl font-bold mb-6">🚀 Embed in Framer (3 Steps)</h2>

          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="font-semibold mb-2">Step 1: Get Your Replit URL</h3>
              <p className="text-sm text-muted-foreground">
                Copy your Replit project URL from the browser: <code className="bg-muted px-2 py-1 rounded text-xs">https://YOUR-NAME.replit.app</code>
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Step 2: Add to Framer</h3>
              <ol className="text-sm text-muted-foreground space-y-2 mb-4 list-decimal list-inside">
                <li>Open your Framer project</li>
                <li>Go to <strong>Settings → General → Custom Code</strong></li>
                <li>Find <strong>"End of body tag"</strong></li>
                <li>Paste the code below</li>
              </ol>
              
              <div className="relative">
                <pre className="bg-card p-4 rounded-lg overflow-x-auto text-xs border">
                  <code>{framerCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(framerCode, setCopiedFramer)}
                >
                  {copiedFramer ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="font-semibold mb-2">Step 3: Publish</h3>
              <p className="text-sm text-muted-foreground">
                Click <strong>Publish</strong> in Framer - the chatbot appears instantly!
              </p>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm"><strong>💡 Done!</strong> Your Framer site now has an AI chatbot with neon design, curved text, and glass-morphism effects.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
