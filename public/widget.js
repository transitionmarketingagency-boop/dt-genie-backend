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
              <h3>${CHATBOT_NAME}</h3>
              <p>Online</p>
            </div>
            <button id="dt-genie-close">×</button>
          </div>

          <div id="dt-genie-messages"></div>

          <div id="dt-genie-input-container">
            <textarea id="dt-genie-input" placeholder="Type your message..."></textarea>
            <button id="dt-genie-send">Send</button>
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
    div.innerHTML = content; // Use innerHTML to allow clickable links
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('dt-genie-messages');
    const div = document.createElement('div');
    div.id = 'dt-genie-typing';
    div.innerText = 'Typing...';
    container.appendChild(div);
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

      /* =====================================================
         ✅ ADDITIVE BOOKING SYSTEM (NON-INVASIVE)
      ===================================================== */
      const bookingKeywords = [
        "book", "schedule", "strategy call", "meeting", "call", "consultation"
      ];

      const now = Date.now();
      const cooldown = 5 * 60 * 1000;

      if (
        bookingKeywords.some(k => message.toLowerCase().includes(k)) &&
        (!sessionData.lastCalendlyOpen || now - sessionData.lastCalendlyOpen > cooldown)
      ) {
        sessionData.lastCalendlyOpen = now;
        sessionData.bookingIntentCount = (sessionData.bookingIntentCount || 0) + 1;
        saveSession();

        // Pass last 5 messages as context to Calendly notes
        const contextNote = encodeURIComponent(
          messageHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join(' | ')
        );

        setTimeout(() => {
          // Trigger real Calendly badge if exists
          if (window.openCalendlyPopup) {
            window.openCalendlyPopup();
          } else if (window.Calendly) {
            Calendly.initPopupWidget({
              url:
                "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future" +
                "?notes=" + contextNote
            });
          }
        }, 800);

        // ✅ Add clickable link in chat as well
        addMessage(
          'assistant',
          'Or you can also schedule directly here: <a href="https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future" target="_blank">Book Your Strategy Call</a>'
        );
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
      if (sessionData.lastCalendlyOpen) {
        addMessage('assistant', "Welcome back! Want to continue booking your strategy call?");
      }
    } else {
      panel.classList.remove('open');
    }
  }

  function init() {
    createWidget();

    document.getElementById('dt-genie-button').onclick = () => togglePanel();
    document.getElementById('dt-genie-close').onclick = () => togglePanel(false);
    document.getElementById('dt-genie-send').onclick = () =>
      sendMessage(document.getElementById('dt-genie-input').value);

    // Enter key sends message
    document.getElementById('dt-genie-input').addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(document.getElementById('dt-genie-input').value);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
