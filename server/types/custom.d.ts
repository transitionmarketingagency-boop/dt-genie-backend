// server/types/custom.d.ts
declare module '@shared/schema';
declare module '@shared/types';

declare module "./services/gemini";
declare module './storage';
declare module './services/memory';
declare module './services/embeddings';
declare module './services/crawler';
declare module './services/fileParser';
declare module './middleware/rateLimit';

// Replit Vite plugins
declare module '@replit/vite-plugin-runtime-error-modal';
declare module '@replit/vite-plugin-cartographer';
declare module '@replit/vite-plugin-dev-banner';

// Missing external modules without types
declare module 'drizzle-orm';
declare module 'drizzle-orm/pg-core';
declare module 'drizzle-zod';
declare module '@vitejs/plugin-react';
declare module 'cors';


