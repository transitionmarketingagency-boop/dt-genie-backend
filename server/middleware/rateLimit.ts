import rateLimit from "express-rate-limit";

export const chatRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: "Too many chat requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

export const trainingRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: "Too many training requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

export const memoryRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: "Too many memory requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
