import fetch from "node-fetch"; // if Node v18+, fetch is built-in
import { v4 as uuidv4 } from "uuid";

const SERVER_URL = "http://localhost:5000/chat";

// Simulate multiple users
const USERS = 5; // number of users to simulate
const MESSAGES = [
  "Tell me about your services",
  "What makes your company different?",
  "Do you offer training?",
  "How can I contact you?",
  "Explain your digital strategy process"
];

async function sendMessage(sessionId, message) {
  try {
    const res = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    });
    const data = await res.json();
    console.log(`User: ${message}`);
    console.log(`AI Reply: ${data.reply}\n`);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

async function simulateUsers() {
  const promises = [];

  for (let i = 0; i < USERS; i++) {
    const sessionId = uuidv4();
    for (const message of MESSAGES) {
      promises.push(sendMessage(sessionId, message));
    }
  }

  await Promise.all(promises);
  console.log("✅ All messages sent!");
}

simulateUsers();
