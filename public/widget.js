'use strict';

(function () {

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

  let sessionData = JSON.parse(localStorage.getItem('dtGenieSessionData') || "{}");

  let messageHistory = [];
  let isOpen = false;
  let isProcessing = false;

  /* --------------------------------------------------- */
  function createWidget() {
    const widgetHTML = `
      <div id="dt-genie-widget">
        <div id="dt-genie-button" role="button" aria-label="Open ${CHATBOT_NAME} Chat" tabindex="0">
          <div id="dt-genie-avatar-wrap">
            <img src="https://dt-genie-backend.onrender.com/neon-brain.png"
              alt="${CHATBOT_NAME} icon" width="48" height="48" />
          </div>
          <svg id="dt-genie-curved-text" viewBox="0 0 140 140">
            <defs>
              <path id="circlePath" d="M70,70 m-55,0 a55,55 0 1,1 110,0 a55,55 0 1,1 -110,0"/>
            </defs>
            <text>
              <textPath href="#circlePath" startOffset="0">
                WE ARE HERE • NeonVision •
              </textPath>
            </text>
          </svg>
        </div>

        <div id="dt-genie-panel" role="dialog" aria-hidden="true">
          <div id="dt-genie-header">
            <div id="dt-genie-header-avatar-wrap">
              <img src="https://dt-genie-backend.onrender.com/neon-brain.png"
                alt="${CHATBOT_NAME} icon" width="48" height="48" />
            </div>
            <div id="dt-genie-header-info">
              <h3 id="dt-genie-header-name">${CHATBOT_NAME}</h3>
              <p id="dt-genie-header-status">Online</p>
            </div>
            <button id="dt-genie-close" aria-label="Close Chat">×</button>
          </div>

          <div id="dt-genie-messages"></div>

          <div id="dt-genie-input-container">
            <div id="dt-genie-input-wrapper">
              <textarea id="dt-genie-input" placeholder="Type your message..."></textarea>
<button id="dt-genie-send" aria-label="Send message">
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M3 12L21 3L13 21L11 13L3 12Z"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
  </svg>
</button>

            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  function saveSession() {
    localStorage.setItem('dtGenieSessionData', JSON.stringify(sessionData));
  }

function addMessage(role, content) {
  const container = document.getElementById('dt-genie-messages');
  const div = document.createElement('div');
  div.className = `dt-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'dt-message-bubble';
  bubble.innerText = content;

  div.appendChild(bubble);
  container.appendChild(div);

  requestAnimationFrame(() => {
    if (role === 'assistant') {
      // ✅ Show full response from top
      div.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    } else {
      // ✅ Ensure user sees their own message immediately
      container.scrollTop = container.scrollHeight;
    }
  });
}

function showTyping() {
  const container = document.getElementById('dt-genie-messages');
  const div = document.createElement('div');
  div.id = 'dt-genie-typing';
  div.innerText = 'Typing...';

  container.appendChild(div);

  // ❌ Removed forced scroll
}

  function hideTyping() {
    const el = document.getElementById('dt-genie-typing');
    if (el) el.remove();
  }

  async function sendMessage(message) {
    if (!message.trim() || isProcessing) return;
    isProcessing = true;

    addMessage('user', message);
    messageHistory.push({ role: 'user', content: message });

    showTyping();

    try {
      const response = await fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId })
      });

      const data = await response.json();
      hideTyping();

      addMessage('assistant', data.reply || 'No response received.');
      messageHistory.push({ role: 'assistant', content: data.reply });

      /* Calendly trigger preserved exactly */
      const bookingKeywords = ["book", "schedule", "strategy call", "meeting", "call", "consultation"];
      const now = Date.now();
      const cooldown = 5 * 60 * 1000;

      if (
        bookingKeywords.some(k => message.toLowerCase().includes(k)) &&
        (!sessionData.lastCalendlyOpen || now - sessionData.lastCalendlyOpen > cooldown)
      ) {
        sessionData.lastCalendlyOpen = now;
        sessionData.bookingIntentCount = (sessionData.bookingIntentCount || 0) + 1;
        saveSession();

        const contextNote = encodeURIComponent(
          messageHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join(' | ')
        );

        setTimeout(() => {
          if (window.Calendly) {
            Calendly.initPopupWidget({
              url:
                "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future" +
                "?notes=" + contextNote
            });
          }
        }, 800);
      }

    } catch (err) {
      hideTyping();
      addMessage('assistant', "Sorry, I'm having trouble connecting.");
    } finally {
      isProcessing = false;
    }
  }

  function togglePanel(force) {
    const panel = document.getElementById('dt-genie-panel');
    isOpen = force !== undefined ? force : !isOpen;

    if (isOpen) {
      panel.classList.add('open');


if (!sessionData.introShown && messageHistory.length === 0) {
  addMessage(
    'assistant',
`👋 Welcome to NeonVision

I help businesses grow using AI-powered marketing systems.

⚡ Choose what you want to improve:
• Fix my ads
• Get more leads
• Automate my business
• Book a strategy call`
  );

  sessionData.introShown = true;
  saveSession();
}

    } else {
      panel.classList.remove('open');
    }
  }

  function init() {
    createWidget();

    const input = document.getElementById('dt-genie-input');
    const sendBtn = document.getElementById('dt-genie-send');

    function sendAndClear() {
      const msg = input.value;
      sendMessage(msg);
      input.value = '';
    }

    document.getElementById('dt-genie-button').onclick = () => togglePanel();
    document.getElementById('dt-genie-close').onclick = () => togglePanel(false);
    sendBtn.onclick = sendAndClear;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAndClear();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
