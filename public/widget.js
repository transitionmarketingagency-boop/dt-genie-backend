(function() {
  'use strict';

  const CONFIG = {
    apiEndpoint: 'https://dt-genie-backend.onrender.com/chat',
    avatarUrl: 'https://i.ibb.co/7QpKsCX/cyberpunk-avatar.png', // updated futuristic avatar
    maxHistoryMessages: 10
  };

  const CHATBOT_NAME = 'NeonVision'; // updated chatbot name

  let sessionId = localStorage.getItem('dtGenieSession');
  if (!sessionId) {
    sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('dtGenieSession', sessionId);
  }

  let messageHistory = [];
  let isOpen = false;
  let isProcessing = false;

  function createWidget() {
    const widgetHTML = `
      <div id="dt-genie-widget">
        <!-- Floating Widget Button with Curved Text -->
        <div id="dt-genie-button" role="button" aria-label="Open ${CHATBOT_NAME} Chat" tabindex="0">
          <img id="dt-genie-avatar" src="${CONFIG.avatarUrl}" alt="${CHATBOT_NAME}" />
          <svg id="dt-genie-curved-text" viewBox="0 0 140 140">
            <text dy="0">
              WE ARE HERE • WE ARE HERE • WE ARE HERE • WE ARE HERE
            </text>
          </svg>
        </div>

        <!-- Chat Panel -->
        <div id="dt-genie-panel" role="dialog" aria-label="${CHATBOT_NAME} Chat">
          <div id="dt-genie-header">
            <img id="dt-genie-header-avatar" src="${CONFIG.avatarUrl}" alt="${CHATBOT_NAME}" />
            <div id="dt-genie-header-info">
              <h3 id="dt-genie-header-name">${CHATBOT_NAME}</h3>
              <p id="dt-genie-header-status">Online</p>
            </div>
            <button id="dt-genie-close" aria-label="Close chat">×</button>
          </div>
          <div id="dt-genie-messages" role="log" aria-live="polite"></div>
          <div id="dt-genie-input-container">
            <div id="dt-genie-input-wrapper">
              <textarea id="dt-genie-input" placeholder="Type your message..." rows="1" aria-label="Message input"></textarea>
              <button id="dt-genie-send" aria-label="Send message">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  function addMessage(role, content, options = {}) {
    const messagesContainer = document.getElementById('dt-genie-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `dt-message ${role}`;
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = `dt-message-bubble${options.newMessage ? ' new-message' : ''}`;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId })
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      hideTyping();
      if (data.reply) addMessage('assistant', data.reply, { newMessage: true });
      else throw new Error('No reply from server');

    } catch (err) {
      console.error('Chat error:', err);
      hideTyping();
      addMessage('assistant', "Sorry, I'm having trouble connecting. Please try again.", { newMessage: true });
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
        addMessage('assistant', `Hello! I'm ${CHATBOT_NAME}, your AI assistant for Digital Transition Marketing. How can I help you today?`);
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
    button.addEventListener('keypress', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); togglePanel(true); } });
    closeBtn.addEventListener('click', () => togglePanel(false));
    sendBtn.addEventListener('click', () => sendMessage(input.value));
    input.addEventListener('keypress', e => { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(input.value); } });
    input.addEventListener('input', () => autoResizeTextarea(input));

    console.log(`✨ ${CHATBOT_NAME} widget loaded successfully`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
