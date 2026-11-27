CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  sessionId TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_timestamp
  ON chat_messages (sessionId, timestamp);

CREATE TABLE IF NOT EXISTS strategic_memory (
  sessionId TEXT PRIMARY KEY NOT NULL,
  industry TEXT,
  businessType TEXT,
  goals TEXT,
  servicesDiscussed TEXT,
  leadScore REAL,
  stage TEXT,
  budget REAL,
  timeline TEXT,
  decisionMaker TEXT,
  interestLevel TEXT,
  lastUserProblem TEXT,
  lastDetectedServices TEXT,
  lastIntent TEXT,
  bantSignals TEXT,
  conversionProbability REAL,
  ctaReadiness REAL,
  intentMomentum REAL,
  updatedAt TEXT,
  lastInteraction REAL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  serviceType TEXT,
  preferredTime TEXT,
  email TEXT,
  calendlyLink TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_created
  ON bookings (userId, createdAt);

INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES (1, CURRENT_TIMESTAMP);

