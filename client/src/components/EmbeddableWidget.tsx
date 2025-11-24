import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

export default function EmbeddableWidget() {
  const [copied, setCopied] = useState(false);

  const widgetCode = `<!-- Digital Transition Marketing AI Chatbot Widget -->
<div id="dtm-chatbot-widget"></div>
<script>
  (function() {
    const BACKEND_URL = 'http://localhost:8080';
    const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const styles = \`
      #dtm-chatbot-container { position: fixed; bottom: 24px; right: 24px; z-index: 9999; font-family: 'Inter', -apple-system, sans-serif; }
      #dtm-chat-button { width: 60px; height: 60px; border-radius: 50%; background: hsl(217, 91%, 60%); color: white; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.12); display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
      #dtm-chat-button:hover { transform: scale(1.05); }
      #dtm-chat-button svg { width: 24px; height: 24px; }
      #dtm-chat-window { display: none; width: 380px; max-width: calc(100vw - 32px); height: 600px; background: white; border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.15); flex-direction: column; overflow: hidden; }
      #dtm-chat-window.open { display: flex; animation: slideUp 0.3s ease-out; }
      #dtm-chat-header { background: hsl(217, 91%, 60%); color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center; }
      #dtm-chat-messages { flex: 1; overflow-y: auto; padding: 16px; }
      #dtm-chat-input-container { padding: 16px; border-top: 1px solid #e5e7eb; }
      #dtm-chat-input-wrapper { display: flex; gap: 8px; }
      #dtm-chat-input { flex: 1; padding: 10px 16px; border: 1px solid #d1d5db; border-radius: 24px; outline: none; }
      #dtm-chat-send { width: 36px; height: 36px; border-radius: 50%; background: hsl(217, 91%, 60%); color: white; border: none; cursor: pointer; }
      .dtm-message { display: flex; margin-bottom: 12px; }
      .dtm-message.user { justify-content: flex-end; }
      .dtm-message-bubble { max-width: 75%; padding: 10px 12px; border-radius: 16px; }
      .dtm-message.user .dtm-message-bubble { background: hsl(217, 91%, 60%); color: white; border-bottom-right-radius: 4px; }
      .dtm-message.assistant .dtm-message-bubble { background: #f3f4f6; color: #1f2937; border-bottom-left-radius: 4px; }
      .dtm-typing { display: flex; gap: 4px; padding: 8px; }
      .dtm-typing-dot { width: 8px; height: 8px; background: #9ca3af; border-radius: 50%; animation: bounce 1.4s infinite; }
      .dtm-typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .dtm-typing-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @media (max-width: 768px) { #dtm-chat-window { width: calc(100vw - 32px); } }
    \`;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    
    const container = document.createElement('div');
    container.id = 'dtm-chatbot-container';
    container.innerHTML = \`
      <button id="dtm-chat-button" aria-label="Open chat">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
      </button>
      <div id="dtm-chat-window">
        <div id="dtm-chat-header">
          <div>
            <div style="font-weight: 600; font-size: 14px;">Digital Transition Marketing</div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;"><span style="display: inline-block; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; margin-right: 4px;"></span>Online</div>
          </div>
          <button id="dtm-chat-close" style="background: transparent; border: none; color: white; cursor: pointer; padding: 4px;">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div id="dtm-chat-messages"></div>
        <div id="dtm-chat-input-container">
          <div id="dtm-chat-input-wrapper">
            <input type="text" id="dtm-chat-input" placeholder="Type your message..." />
            <button id="dtm-chat-send">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
          </div>
          <p style="text-align: center; font-size: 11px; color: #6b7280; margin-top: 8px;">Powered by AI</p>
        </div>
      </div>
    \`;
    
    document.getElementById('dtm-chatbot-widget').appendChild(container);
    
    const chatButton = document.getElementById('dtm-chat-button');
    const chatWindow = document.getElementById('dtm-chat-window');
    const chatClose = document.getElementById('dtm-chat-close');
    const chatInput = document.getElementById('dtm-chat-input');
    const chatSend = document.getElementById('dtm-chat-send');
    const messagesContainer = document.getElementById('dtm-chat-messages');
    
    let isOpen = false;
    
    function addMessage(role, content) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'dtm-message ' + role;
      messageDiv.innerHTML = \`<div class="dtm-message-bubble">\${content}</div>\`;
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function showTyping() {
      const typingDiv = document.createElement('div');
      typingDiv.id = 'dtm-typing-indicator';
      typingDiv.className = 'dtm-message assistant';
      typingDiv.innerHTML = '<div class="dtm-message-bubble"><div class="dtm-typing"><div class="dtm-typing-dot"></div><div class="dtm-typing-dot"></div><div class="dtm-typing-dot"></div></div></div>';
      messagesContainer.appendChild(typingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function hideTyping() {
      const typingIndicator = document.getElementById('dtm-typing-indicator');
      if (typingIndicator) typingIndicator.remove();
    }
    
    async function sendMessage(message) {
      addMessage('user', message);
      showTyping();
      
      try {
        const response = await fetch(\`\${BACKEND_URL}/chat\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId })
        });
        
        const data = await response.json();
        hideTyping();
        addMessage('assistant', data.reply);
      } catch (error) {
        hideTyping();
        addMessage('assistant', 'Sorry, I\\'m having trouble connecting. Please try again.');
      }
    }
    
    chatButton.addEventListener('click', function() {
      isOpen = true;
      chatButton.style.display = 'none';
      chatWindow.classList.add('open');
      if (messagesContainer.children.length === 0) {
        addMessage('assistant', 'Hello! I\\'m the AI assistant for Digital Transition Marketing. I can help you learn about our services including social media marketing, SEO, web development, and more. How can I assist you today?');
      }
      chatInput.focus();
    });
    
    chatClose.addEventListener('click', function() {
      isOpen = false;
      chatWindow.classList.remove('open');
      chatButton.style.display = 'flex';
    });
    
    function handleSend() {
      const message = chatInput.value.trim();
      if (message) {
        sendMessage(message);
        chatInput.value = '';
      }
    }
    
    chatSend.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleSend();
    });
  })();
</script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(widgetCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-embed-title">
            Embeddable Widget Code
          </h3>
          <p className="text-sm text-muted-foreground">
            Copy this code and paste it into your website's HTML (works with Framer, WordPress, or any HTML site)
          </p>
        </div>

        <div className="relative">
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs max-h-[400px] overflow-y-auto">
            <code data-testid="code-widget">{widgetCode}</code>
          </pre>
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2"
            onClick={handleCopy}
            data-testid="button-copy-code"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy Code
              </>
            )}
          </Button>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">Setup Instructions:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
            <li>Copy the code above</li>
            <li>Paste it before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag in your website</li>
            <li>Make sure your backend server is running on port 8080</li>
            <li>The chat widget will appear in the bottom-right corner</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}
