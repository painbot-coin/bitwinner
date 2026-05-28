const rateLimit = require('express-rate-limit');

const createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: {
      success: false,
      message: options.message || 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    }
  });
};

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: 'Too many login attempts, please try again after 15 minutes'
});

const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour per IP
  message: 'Too many accounts created from this IP, please try again after an hour'
});

const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset requests per hour
  message: 'Too many password reset requests, please try again after an hour'
});

const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests, please slow down'
});

const gameLimiter = createRateLimiter({
  windowMs: 1 * 1000, // 1 second
  max: 10, // 10 game actions per second
  message: 'Too many game actions, please slow down'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  signupLimiter,
  passwordResetLimiter,
  apiLimiter,
  gameLimiter
};
