'use strict';

(function () {

  const CONFIG = {
    apiEndpoint: 'https://dt-genie-backend.onrender.com/chat',
    maxHistoryMessages: 10
  };

  const CHATBOT_NAME = 'NeonVision';
  const BOOKING_URL = 'https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future';

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
let userIsScrolling = false;
let scrollTimeout;

  /* --------------------------------------------------- */
  function createWidget() {
    const widgetHTML = `
      <div id="dt-genie-widget">
        <div id="dt-genie-button" role="button" aria-label="Open ${CHATBOT_NAME} Chat" tabindex="0">
          <div id="dt-genie-avatar-wrap">
            <img src="https://dt-genie-backend.onrender.com/neonvision-mark.svg?v=icon-v1"
              alt="${CHATBOT_NAME} AI icon" width="48" height="48" />
          </div>
          <svg id="dt-genie-curved-text" viewBox="0 0 140 140">
            <defs>
              <path id="circlePath" d="M70,70 m-55,0 a55,55 0 1,1 110,0 a55,55 0 1,1 -110,0"/>
            </defs>
            <text>
              <textPath href="#circlePath" startOffset="0">
                YOUR AI GROWTH ASSISTANT • NEONVISION •
              </textPath>
            </text>
          </svg>
        </div>

        <div id="dt-genie-panel" role="dialog" aria-hidden="true">
          <div id="dt-genie-header">
            <div id="dt-genie-header-avatar-wrap">
              <img src="https://dt-genie-backend.onrender.com/neonvision-mark.svg?v=icon-v1"
                alt="${CHATBOT_NAME} AI icon" width="48" height="48" />
            </div>
            <div id="dt-genie-header-info">
              <h3 id="dt-genie-header-name"><span class="neonvision-word-neon">Neon</span><span class="neonvision-word-vision">Vision</span></h3>
              <p id="dt-genie-header-status">Online · DTM growth intelligence</p>
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
  if (!container) return;

  // ✅ Capture position BEFORE DOM change
  const wasNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 200;

  const div = document.createElement('div');
  div.className = `dt-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'dt-message-bubble';
  bubble.innerText = content;

  div.appendChild(bubble);
  container.appendChild(div);

  requestAnimationFrame(() => {
    const container = document.getElementById('dt-genie-messages');
    if (!container) return;

    // ✅ ALWAYS scroll for user messages
    if (role === 'user') {
      container.scrollTop = container.scrollHeight;
      return;
    }

    // ✅ SMART scroll for assistant messages
    if (!userIsScrolling && wasNearBottom) {
      if (role === 'assistant') {
        // 🔥 Scroll to START of AI message (FIXED)
        div.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
  });
}


function renderQuickActions() {
  const container = document.getElementById('dt-genie-messages');
  if (!container) return;

  // prevent duplicates
  if (container.querySelector('.dt-quick-actions')) return;

  // ✅ capture BEFORE DOM change
  const wasNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 200;

  const wrapper = document.createElement('div');
  wrapper.className = 'dt-quick-actions';

  const actions = [
    { text: "🚀 Fix ads", value: "Fix my ads" },
    { text: "🎯 Get leads", value: "Get more leads" },
    { text: "⚙️ Automate", value: "Automate my business" },
    { text: "📞 Book call", value: "Book a strategy call" }
  ];

  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'dt-quick-btn';
    btn.innerText = a.text;
    btn.onclick = () => sendMessage(a.value);
    wrapper.appendChild(btn);
  });

  const block = document.createElement('div');
  block.className = 'dt-message assistant';

  const bubble = document.createElement('div');
  bubble.className = 'dt-message-bubble';

  bubble.appendChild(wrapper);
  block.appendChild(bubble);
  container.appendChild(block);

  requestAnimationFrame(() => {
    if (!userIsScrolling && wasNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  });
}


function showTyping() {
  const container = document.getElementById('dt-genie-messages');
  if (!container) return;

  // ✅ capture BEFORE DOM change
  const wasNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 200;

  const wrapper = document.createElement('div');
  wrapper.id = 'dt-genie-typing';
  wrapper.className = 'dt-message assistant';

  const bubble = document.createElement('div');
  bubble.className = 'dt-message-bubble';

  const typing = document.createElement('div');
  typing.className = 'dt-typing';

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'dt-typing-dot';
    typing.appendChild(dot);
  }

  function addBookingLink() {
    const container = document.getElementById('dt-genie-messages');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'dt-message assistant';
    const bubble = document.createElement('div');
    bubble.className = 'dt-message-bubble';
    const link = document.createElement('a');
    link.href = BOOKING_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Choose a strategy call time';
    link.style.cssText = 'display:inline-block;padding:10px 14px;border-radius:8px;background:#00d9ff;color:#071018;font-weight:600;text-decoration:none;';
    bubble.appendChild(link);
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  bubble.appendChild(typing);
  wrapper.appendChild(bubble);
  container.appendChild(wrapper);

  requestAnimationFrame(() => {
    if (!userIsScrolling && wasNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  });
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
      if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error(`Chat service returned HTTP ${response.status}`);
      }
      hideTyping();

      addMessage('assistant', data.reply || 'No response received.');
      const bookingRequest = /\b(?:book|schedule)\s+(?:a\s+)?(?:strategy\s+)?(?:call|meeting)\b|\b(?:i want to|can i|let's)\s+(?:book|schedule)\b/i.test(message);
      if (bookingRequest) {
        try {
          addBookingLink();
        } catch (uiError) {
          console.warn('[NeonVision] Could not render the booking link.', uiError);
        }
      }

      try {
        messageHistory.push({ role: 'assistant', content: data.reply });
        sessionData.lastUserIntent = message;
        saveSession();
      } catch (storageError) {
        console.warn('[NeonVision] Reply was shown, but chat history could not be saved.', storageError);
      }

    } catch (err) {
      hideTyping();
      addMessage('assistant', "I couldn't reach the chat service just now. Please try again in a moment.");
      if (/\b(?:book|schedule)\s+(?:a\s+)?(?:strategy\s+)?(?:call|meeting)\b/i.test(message)) {
        addBookingLink();
      }
    } finally {
      isProcessing = false;
    }
  }


function togglePanel(force) {
  const panel = document.getElementById('dt-genie-panel');
  const container = document.getElementById('dt-genie-messages');

  isOpen = force !== undefined ? force : !isOpen;

  if (isOpen) {
    panel.classList.add('open');

    // ✅ ONLY RUN ON FIRST OPEN (SAFE + CLEAN)
const isFirstLoad = container.children.length === 0;

    if (isFirstLoad) {
      showTyping();

      setTimeout(() => {
        hideTyping();

        addMessage(
          'assistant',
`Welcome to Digital Transition Marketing. I’m NeonVision.

I can help you explore growth challenges and possible next steps across marketing, customer experience, and technology.

⚡ Pick an action below or tell me what you want to improve.`
        );

        // ✅ Render quick actions ONCE
        requestAnimationFrame(() => {
          renderQuickActions();
        });

      }, 650);
    }

  } else {
    panel.classList.remove('open');
  }
}


function attachScrollListener() {
  const tryAttach = () => {
    const container = document.getElementById('dt-genie-messages');
    if (!container) return false;

    container.addEventListener('wheel', () => {
      userIsScrolling = true;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        userIsScrolling = false;
      }, 1500);
    }, { passive: true });

    return true;
  };

  // try immediately
  if (tryAttach()) return;

  // retry until DOM exists (CRITICAL FIX)
  const interval = setInterval(() => {
    if (tryAttach()) {
      clearInterval(interval);
    }
  }, 500);
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

  // ✅ CRITICAL: attach scroll safety AFTER DOM exists
  attachScrollListener();
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
