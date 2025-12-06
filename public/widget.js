(function () {
  'use strict';

  const CONFIG = {
    apiEndpoint: 'https://dt-genie-backend.onrender.com/chat',
    maxHistoryMessages: 10
  };

  const CHATBOT_NAME = 'NeonVision';

  let sessionId = localStorage.getItem('dtGenieSession');
  if (!sessionId) {
    sessionId =
      'session-' +
      Date.now() +
      '-' +
      Math.random().toString(36).substr(2, 9);
    localStorage.setItem('dtGenieSession', sessionId);
  }

  let messageHistory = [];
  let isOpen = false;
  let isProcessing = false;

  /* ---------------------------------------------------
     CREATE WIDGET
     --------------------------------------------------- */
  function createWidget() {
    const widgetHTML = `
      <div id="dt-genie-widget" aria-hidden="false">

        <div id="dt-genie-button" role="button" aria-label="Open ${CHATBOT_NAME} Chat" tabindex="0">
          <div id="dt-genie-avatar-wrap">
            <img src="public/neon-brain.png" alt="${CHATBOT_NAME} icon" width="56" height="56" />
          </div>

          <svg id="dt-genie-curved-text" viewBox="0 0 140 140">
            <defs>
              <path id="circlePath" d="M70,70 m-55,0 a55,55 0 1,1 110,0 a55,55 0 1,1 -110,0"/>
            </defs>
            <text>
              <textPath href="#circlePath" startOffset="0">
                WE ARE HERE • WE ARE HERE • WE ARE HERE •
              </textPath>
            </text>
          </svg>
        </div>

        <div id="dt-genie-panel" role="dialog" aria-label="${CHATBOT_NAME} Chat" aria-hidden="true">
          <div id="dt-genie-header">
            <div id="dt-genie-header-avatar-wrap">
              <img src="public/neon-brain.png" alt="${CHATBOT_NAME} icon" width="48" height="48" />
            </div>
            <div id="dt-genie-header-info">
              <h3 id="dt-genie-header-name">${CHATBOT_NAME}</h3>
              <p id="dt-genie-header-status">Online</p>
            </div>
            <button id="dt-genie-close" aria-label="Close chat">×</button>
          </div>

          <div id="dt-genie-messages"></div>

          <div id="dt-genie-input-container">
            <div id="dt-genie-input-wrapper">
              <textarea id="dt-genie-input" placeholder="Type your message..." rows="1"></textarea>
              <button id="dt-genie-send">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  /* ---------------------------------------------------
     MESSAGE HANDLING
     --------------------------------------------------- */
  function addMessage(role, content, options = {}) {
    const messagesContainer = document.getElementById('dt-genie-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `dt-message ${role}`;
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className =
      `dt-message-bubble${options.newMessage ? ' new-message' : ''}`;
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
      addMessage('assistant', data.reply, { newMessage: true });

    } catch (err) {
      hideTyping();
      addMessage(
        'assistant',
        "Sorry, I'm having trouble connecting. Try again in a moment.",
        { newMessage: true }
      );
    } finally {
      isProcessing = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  /* ---------------------------------------------------
     TOGGLE PANEL
     --------------------------------------------------- */
  function togglePanel(force) {
    const panel = document.getElementById('dt-genie-panel');

    // Toggle state
    isOpen = force !== undefined ? force : !isOpen;

    if (isOpen) {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');

      const messagesContainer = document.getElementById('dt-genie-messages');
      if (messagesContainer.children.length === 0) {
        addMessage(
          'assistant',
          `Hello! I'm ${CHATBOT_NAME}, your AI assistant. How can I help you today?`
        );
      }
    } else {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  /* ---------------------------------------------------
     INITIALIZE
     --------------------------------------------------- */
  function init() {
    createWidget();

    const button = document.getElementById('dt-genie-button');
    const closeBtn = document.getElementById('dt-genie-close');
    const input = document.getElementById('dt-genie-input');
    const sendBtn = document.getElementById('dt-genie-send');

    // Toggle panel on click
    button.addEventListener('click', () => togglePanel());
    button.addEventListener('keypress', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePanel();
      }
    });

    closeBtn.addEventListener('click', () => togglePanel(false));

    sendBtn.addEventListener('click', () => sendMessage(input.value));

    input.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });

    input.addEventListener('input', () => autoResizeTextarea(input));

    console.log(`✨ ${CHATBOT_NAME} widget ready`);
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();
})();
