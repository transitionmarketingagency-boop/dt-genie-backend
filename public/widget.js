(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiEndpoint: 'https://e80080f9-353f-47ca-9d3a-354fe040db23-00-1s5mi7w3iqtau.worf.replit.dev/api/chat',
    avatarUrl: 'https://e80080f9-353f-47ca-9d3a-354fe040db23-00-1s5mi7w3iqtau.worf.replit.dev/avatar.png',
    maxHistoryMessages: 10
  };


  // Message history for context
  let messageHistory = [];
  let isOpen = false;
  let isProcessing = false;
  let sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

  // Create widget HTML
  function createWidget() {
    const widgetHTML = `
      <div id="dt-genie-widget">
        <!-- Floating Button -->
        <div id="dt-genie-button" role="button" aria-label="Open DT Genie Chat" tabindex="0">
          <img id="dt-genie-avatar" src="${CONFIG.avatarUrl}" alt="DT Genie" />
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

        <!-- Chat Panel -->
        <div id="dt-genie-panel" role="dialog" aria-label="DT Genie Chat">
          <!-- Header -->
          <div id="dt-genie-header">
            <img id="dt-genie-header-avatar" src="${CONFIG.avatarUrl}" alt="DT Genie" />
            <div id="dt-genie-header-info">
              <h3 id="dt-genie-header-name">DT Genie</h3>
              <p id="dt-genie-header-status">Online</p>
            </div>
            <button id="dt-genie-close" aria-label="Close chat">×</button>
          </div>

          <!-- Messages -->
          <div id="dt-genie-messages" role="log" aria-live="polite"></div>

          <!-- Input -->
          <div id="dt-genie-input-container">
            <div id="dt-genie-input-wrapper">
              <textarea 
                id="dt-genie-input" 
                placeholder="Type your message..." 
                rows="1"
                aria-label="Message input"
              ></textarea>
              <button id="dt-genie-send" aria-label="Send message">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  // Add message to chat
  function addMessage(role, content, options = {}) {
    const messagesContainer = document.getElementById('dt-genie-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `dt-message ${role}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = `dt-message-bubble${options.newMessage ? ' new-message' : ''}`;
    bubbleDiv.textContent = content;
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Show typing indicator
  function showTyping() {
    const messagesContainer = document.getElementById('dt-genie-messages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'dt-genie-typing';
    typingDiv.className = 'dt-message assistant';
    typingDiv.innerHTML = `
      <div class="dt-message-bubble">
        <div class="dt-typing">
          <div class="dt-typing-dot"></div>
          <div class="dt-typing-dot"></div>
          <div class="dt-typing-dot"></div>
        </div>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Hide typing indicator
  function hideTyping() {
    const typingDiv = document.getElementById('dt-genie-typing');
    if (typingDiv) {
      typingDiv.remove();
    }
  }

  // Send message to backend
  async function sendMessage(message) {
    if (!message.trim() || isProcessing) return;
    
    isProcessing = true;
    const sendButton = document.getElementById('dt-genie-send');
    sendButton.disabled = true;
    
    // Add user message
    addMessage('user', message);
    
    // Clear input
    const input = document.getElementById('dt-genie-input');
    input.value = '';
    input.style.height = 'auto';
    
    // Show typing
    showTyping();
    
    try {
      const response = await fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          sessionId: sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      hideTyping();
      
      if (data.reply) {
        addMessage('assistant', data.reply, { newMessage: true });
      } else {
        throw new Error('No reply from server');
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      hideTyping();
      addMessage('assistant', 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.', { newMessage: true });
    } finally {
      isProcessing = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  // Toggle chat panel
  function togglePanel(open) {
    const panel = document.getElementById('dt-genie-panel');
    const button = document.getElementById('dt-genie-button');
    
    isOpen = open !== undefined ? open : !isOpen;
    
    if (isOpen) {
      panel.classList.add('open');
      button.style.display = 'none';
      
      // Add welcome message if first time opening
      const messagesContainer = document.getElementById('dt-genie-messages');
      if (messagesContainer.children.length === 0) {
        addMessage('assistant', 'Hello! I\'m DT Genie, your AI assistant for Digital Transition Marketing. How can I help you today?');
      }
      
      // Focus input
      setTimeout(() => {
        document.getElementById('dt-genie-input').focus();
      }, 100);
    } else {
      panel.classList.remove('open');
      button.style.display = 'flex';
    }
  }

  // Auto-resize textarea
  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // Initialize widget
  function init() {
    createWidget();
    
    // Event listeners
    const button = document.getElementById('dt-genie-button');
    const closeBtn = document.getElementById('dt-genie-close');
    const sendBtn = document.getElementById('dt-genie-send');
    const input = document.getElementById('dt-genie-input');
    
    // Open chat
    button.addEventListener('click', () => togglePanel(true));
    button.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePanel(true);
      }
    });
    
    // Close chat
    closeBtn.addEventListener('click', () => togglePanel(false));
    
    // Send message
    sendBtn.addEventListener('click', () => {
      sendMessage(input.value);
    });
    
    // Send on Enter (Shift+Enter for new line)
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });
    
    // Auto-resize textarea
    input.addEventListener('input', () => {
      autoResizeTextarea(input);
    });
    
    console.log('✨ DT Genie widget loaded successfully');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
