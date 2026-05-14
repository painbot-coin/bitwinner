const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { User } = require('../models');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  getTokenExpiration 
} = require('../utils/jwt');
const { 
  sendVerificationEmail, 
  sendPasswordResetEmail,
  sendWelcomeEmail 
} = require('../utils/email');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

const clearTokenCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};

// Sign Up
exports.signup = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }
    
    // Check if username already exists
    const existingUsername = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken'
      });
    }
    
    // Create user
    const user = new User({
      email: email.toLowerCase(),
      username,
      password,
      balance: 100 // Starting bonus for new users
    });
    
    // Auto-verify in development if SMTP is not configured
    const skipEmailVerification = process.env.NODE_ENV === 'development' && 
                                   (!process.env.SMTP_USER || !process.env.SMTP_PASS);
    
    if (skipEmailVerification) {
      user.isEmailVerified = true;
      await user.save();
      console.log('Dev mode: Auto-verified user (SMTP not configured)');
    } else {
      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();
      
      // Send verification email
      try {
        await sendVerificationEmail(user, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
    }
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Store refresh token
    user.refreshTokens.push({
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: getTokenExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    await user.save();
    
    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      user: user.toPrivateJSON(),
      accessToken
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account'
    });
  }
};

// Sign In
exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check if account is locked
    if (user.isLocked) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account is locked. Try again in ${lockTime} minutes.`
      });
    }
    
    // Check if user has password (might be OAuth only)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'Please sign in with Google'
      });
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Reset login attempts on successful login
    await user.resetLoginAttempts();
    
    // Update last login
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Store refresh token (keep max 5 sessions)
    user.refreshTokens = user.refreshTokens.slice(-4);
    user.refreshTokens.push({
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: getTokenExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    await user.save();
    
    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    res.json({
      success: true,
      message: 'Signed in successfully',
      user: user.toPrivateJSON(),
      accessToken
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sign in'
    });
  }
};

// Google OAuth
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
    }
    
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    
    // Find or create user
    let user = await User.findOne({
      $or: [
        { googleId },
        { email: email.toLowerCase() }
      ]
    });
    
    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
      }
      // Update avatar if not set
      if (!user.avatar && picture) {
        user.avatar = picture;
      }
      // Mark email as verified (Google verified it)
      user.isEmailVerified = true;
    } else {
      // Create new user
      const username = await generateUniqueUsername(name || email.split('@')[0]);
      
      user = new User({
        email: email.toLowerCase(),
        username,
        googleId,
        avatar: picture,
        isEmailVerified: true,
        balance: 100 // Starting bonus
      });
    }
    
    // Update last login
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Store refresh token
    user.refreshTokens = user.refreshTokens.slice(-4);
    user.refreshTokens.push({
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: getTokenExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    await user.save();
    
    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    // Send welcome email for new users
    if (user.stats.gamesPlayed === 0) {
      try {
        await sendWelcomeEmail(user);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: 'Signed in with Google successfully',
      user: user.toPrivateJSON(),
      accessToken
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authenticate with Google'
    });
  }
};

// Generate unique username
async function generateUniqueUsername(baseName) {
  let username = baseName.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15);
  if (username.length < 3) {
    username = 'user';
  }
  
  let exists = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
  if (!exists) return username;
  
  let counter = 1;
  while (exists) {
    const newUsername = `${username}${counter}`;
    exists = await User.findOne({ username: { $regex: new RegExp(`^${newUsername}$`, 'i') } });
    if (!exists) return newUsername;
    counter++;
  }
  
  return `${username}${Date.now()}`;
}

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not provided'
      });
    }
    
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      clearTokenCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.isBanned) {
      clearTokenCookies(res);
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }
    
    // Verify refresh token exists in user's tokens
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenIndex = user.refreshTokens.findIndex(t => t.token === tokenHash);
    
    if (tokenIndex === -1) {
      clearTokenCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked'
      });
    }
    
    // Remove old token
    user.refreshTokens.splice(tokenIndex, 1);
    
    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    
    // Store new refresh token
    user.refreshTokens.push({
      token: crypto.createHash('sha256').update(newRefreshToken).digest('hex'),
      expiresAt: getTokenExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    await user.save();
    
    // Set cookies
    setTokenCookies(res, newAccessToken, newRefreshToken);
    
    res.json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
};

// Sign Out
exports.signout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (refreshToken && req.user) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: { token: tokenHash } }
      });
    }
    
    clearTokenCookies(res);
    
    res.json({
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error('Signout error:', error);
    clearTokenCookies(res);
    res.json({
      success: true,
      message: 'Signed out'
    });
  }
};

// Sign Out All Sessions
exports.signoutAll = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { refreshTokens: [] }
    });
    
    clearTokenCookies(res);
    
    res.json({
      success: true,
      message: 'Signed out from all devices'
    });
  } catch (error) {
    console.error('Signout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sign out from all devices'
    });
  }
};

// Verify Email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    // Send welcome email
    try {
      await sendWelcomeEmail(user);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify email'
    });
  }
};

// Resend Verification Email
exports.resendVerification = async (req, res) => {
  try {
    const user = req.user;
    
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }
    
    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      // Auto-verify in development
      if (process.env.NODE_ENV === 'development') {
        user.isEmailVerified = true;
        await user.save();
        return res.json({
          success: true,
          message: 'Email auto-verified (dev mode - SMTP not configured)'
        });
      }
      return res.status(503).json({
        success: false,
        message: 'Email service not configured'
      });
    }
    
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    
    await sendVerificationEmail(user, verificationToken);
    
    res.json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification email'
    });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent'
      });
    }
    
    // Check if user has password (not OAuth only)
    if (!user.password && user.googleId) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent'
      });
    }
    
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    
    await sendPasswordResetEmail(user, resetToken);
    
    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();
    
    res.json({
      success: true,
      message: 'Password reset successfully. Please sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};

// Change Password (for authenticated users)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for OAuth accounts. Please set a password first.'
      });
    }
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

// Get Current User (returns 200 with user: null when not logged in)
exports.getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ success: true, user: null });
    }
    res.json({
      success: true,
      user: req.user.toPrivateJSON()
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info'
    });
  }
};

// Get Active Sessions
exports.getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get current session token hash
    const currentRefreshToken = req.cookies.refreshToken;
    const currentTokenHash = currentRefreshToken 
      ? crypto.createHash('sha256').update(currentRefreshToken).digest('hex')
      : null;
    
    // Parse user agent to get device info
    const parseUserAgent = (ua) => {
      if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
      
      let browser = 'Unknown';
      let os = 'Unknown';
      let device = 'Desktop';
      
      // Browser detection
      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Edge')) browser = 'Edge';
      else if (ua.includes('Opera')) browser = 'Opera';
      
      // OS detection
      if (ua.includes('Windows')) os = 'Windows';
      else if (ua.includes('Mac')) os = 'macOS';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('Android')) { os = 'Android'; device = 'Mobile'; }
      else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; device = ua.includes('iPad') ? 'Tablet' : 'Mobile'; }
      
      return { browser, os, device };
    };
    
    const sessions = user.refreshTokens
      .filter(t => t.expiresAt > new Date()) // Only active sessions
      .map(t => {
        const deviceInfo = parseUserAgent(t.userAgent);
        return {
          id: t._id.toString(),
          device: deviceInfo.device,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ip: t.ip ? t.ip.replace('::ffff:', '') : 'Unknown',
          createdAt: t.createdAt,
          isCurrent: t.token === currentTokenHash
        };
      })
      .sort((a, b) => b.isCurrent - a.isCurrent || new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      sessions,
      totalSessions: sessions.length
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sessions'
    });
  }
};

// Revoke Specific Session
exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const user = await User.findById(req.user._id);
    
    // Find the session
    const sessionIndex = user.refreshTokens.findIndex(t => t._id.toString() === sessionId);
    
    if (sessionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    // Check if trying to revoke current session
    const currentRefreshToken = req.cookies.refreshToken;
    const currentTokenHash = currentRefreshToken 
      ? crypto.createHash('sha256').update(currentRefreshToken).digest('hex')
      : null;
    
    if (user.refreshTokens[sessionIndex].token === currentTokenHash) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke current session. Use sign out instead.'
      });
    }
    
    // Remove the session
    user.refreshTokens.splice(sessionIndex, 1);
    await user.save();
    
    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke session'
    });
  }
};
