(function() {
  'use strict';

  const CONFIG = {
    apiEndpoint: 'https://dt-genie-backend.onrender.com/chat',
    maxHistoryMessages: 10
  };

  const CHATBOT_NAME = 'NeonVision';
  let sessionId = localStorage.getItem('dtGenieSession');
  if(!sessionId){
    sessionId = 'session-'+Date.now()+'-'+Math.random().toString(36).substr(2,9);
    localStorage.setItem('dtGenieSession', sessionId);
  }

  let isOpen = false, isProcessing = false;

  const NEON_BRAIN_SVG = `<svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="brainGlow" cx="50%" cy="50%">
    <stop offset="0%" stop-color="#00E1FF"/>
    <stop offset="33%" stop-color="#9B59B6"/>
    <stop offset="66%" stop-color="#FF2D95"/>
    <stop offset="100%" stop-color="#00E1FF"/>
  </radialGradient>
  <filter id="neonGlow">
    <feGaussianBlur stdDeviation="8" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<path filter="url(#neonGlow)" fill="url(#brainGlow)" d="M256 30c-70 0-126 56-126 126v20c-22 8-38 28-38 54 0 24 14 45 34 54-6 10-10 22-10 34 0 38 31 69 69 69h18c13 24 39 40 69 40s56-16 69-40h18c38 0 69-31 69-69 0-12-4-24-10-34 20-9 34-30 34-54 0-26-16-46-38-54v-20c0-70-56-126-126-126z"/>
</svg>`;

  function createWidget(){
    const widgetHTML = `<div id="dt-genie-widget" aria-hidden="false">
      <div id="dt-genie-button" role="button" aria-label="Open ${CHATBOT_NAME} Chat" tabindex="0">
        <div id="dt-genie-avatar-wrap">${NEON_BRAIN_SVG}</div>
        <svg id="dt-genie-curved-text" viewBox="0 0 140 140">
          <defs>
            <path id="circlePath" d="M70,70 m-55,0 a55,55 0 1,1 110,0 a55,55 0 1,1 -110,0"/>
          </defs>
          <text><textPath href="#circlePath" startOffset="0">WE ARE HERE • NEONVISION AI • </textPath></text>
        </svg>
      </div>

      <div id="dt-genie-panel" role="dialog" aria-label="${CHATBOT_NAME} Chat" aria-hidden="true">
        <div id="dt-genie-header">
          <div id="dt-genie-header-avatar-wrap">${NEON_BRAIN_SVG}</div>
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
    </div>`;
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  function addMessage(role, content, options={}) {
    const container = document.getElementById('dt-genie-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `dt-message ${role}`;
    const bubble = document.createElement('div');
    bubble.className = `dt-message-bubble${options.newMessage?' new-message':''}`;
    bubble.textContent = content;
    msgDiv.appendChild(bubble);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('dt-genie-messages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'dt-genie-typing';
    typingDiv.className = 'dt-message assistant';
    typingDiv.innerHTML = `<div class="dt-message-bubble"><div class="dt-typing">
      <div class="dt-typing-dot"></div><div class="dt-typing-dot"></div><div class="dt-typing-dot"></div>
    </div></div>`;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;

    // Play typing sound
    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-fast-click-1113.mp3');
    audio.volume = 0.15; audio.play().catch(()=>{});
  }

  function hideTyping() { const t = document.getElementById('dt-genie-typing'); if(t) t.remove(); }

  async function sendMessage(msg){
    if(!msg.trim() || isProcessing) return;
    isProcessing=true;
    const input=document.getElementById('dt-genie-input');
    document.getElementById('dt-genie-send').disabled=true;
    addMessage('user', msg);
    input.value=''; input.style.height='auto';
    showTyping();
    try{
      const res = await fetch(CONFIG.apiEndpoint,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:msg,sessionId})});
      if(!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      hideTyping();
      addMessage('assistant', data.reply, {newMessage:true});
    }catch(e){
      hideTyping();
      addMessage('assistant', "Sorry, I'm having trouble connecting. Try again in a moment.", {newMessage:true});
    }finally{ isProcessing=false; document.getElementById('dt-genie-send').disabled=false; input.focus();}
  }

  function togglePanel(force){
    const panel=document.getElementById('dt-genie-panel');
    isOpen = force!==undefined?force:!isOpen;
    if(isOpen){
      panel.classList.add('open'); panel.setAttribute('aria-hidden','false');
      const msgs=document.getElementById('dt-genie-messages');
      if(msgs.children.length===0) addMessage('assistant', `Hello! I'm ${CHATBOT_NAME}, your AI assistant. How can I help you today?`);
    } else { panel.classList.remove('open'); panel.setAttribute('aria-hidden','true'); }
  }

  function autoResizeTextarea(input){ input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,120)+'px'; }

  function init(){
    createWidget();
    const btn=document.getElementById('dt-genie-button');
    const closeBtn=document.getElementById('dt-genie-close');
    const input=document.getElementById('dt-genie-input');
    const sendBtn=document.getElementById('dt-genie-send');

    btn.addEventListener('click', ()=>togglePanel());
    btn.addEventListener('keypress', e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();togglePanel();}});
    closeBtn.addEventListener('click', ()=>togglePanel(false));
    sendBtn.addEventListener('click', ()=>sendMessage(input.value));
    input.addEventListener('keypress', e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(input.value);}});
    input.addEventListener('input', ()=>autoResizeTextarea(input));

    console.log(`✨ ${CHATBOT_NAME} widget ready`);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
