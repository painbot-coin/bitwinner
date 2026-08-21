const nodemailer = require('nodemailer');

let transporter = null;

const initializeTransporter = () => {
  if (transporter) return transporter;
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('Email service not configured. Email features will be disabled.');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transport = initializeTransporter();
  
  if (!transport) {
    console.log('Email would be sent to:', to);
    console.log('Subject:', subject);
    return { messageId: 'mock-' + Date.now() };
  }
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text
  };
  
  return transport.sendMail(mailOptions);
};

const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #0f0f1a; color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #ffd700; }
        .content { background: #1a1a2e; border-radius: 12px; padding: 30px; }
        .button { display: inline-block; background: linear-gradient(135deg, #ffd700, #ff9500); color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b6b80; font-size: 12px; }
        .link { color: #ffd700; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏁 BitWinner</div>
        </div>
        <div class="content">
          <h2>Verify Your Email</h2>
          <p>Hi ${user.username},</p>
          <p>Welcome to BitWinner! Please verify your email address to complete your registration and start playing.</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email</a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p class="link">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} BitWinner. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Welcome to BitWinner!
    
    Hi ${user.username},
    
    Please verify your email by visiting: ${verificationUrl}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, you can safely ignore this email.
  `;
  
  return sendEmail({
    to: user.email,
    subject: 'Verify Your Email - BitWinner',
    html,
    text
  });
};

const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #0f0f1a; color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #ffd700; }
        .content { background: #1a1a2e; border-radius: 12px; padding: 30px; }
        .button { display: inline-block; background: linear-gradient(135deg, #ff4757, #ff6b7a); color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b6b80; font-size: 12px; }
        .link { color: #ffd700; word-break: break-all; }
        .warning { background: rgba(255, 71, 87, 0.1); border: 1px solid #ff4757; border-radius: 8px; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏁 BitWinner</div>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>Hi ${user.username},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p class="link">${resetUrl}</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} BitWinner. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Reset Your Password
    
    Hi ${user.username},
    
    We received a request to reset your password. Visit this link to create a new password:
    ${resetUrl}
    
    This link will expire in 1 hour.
    
    If you didn't request a password reset, please ignore this email.
  `;
  
  return sendEmail({
    to: user.email,
    subject: 'Reset Your Password - BitWinner',
    html,
    text
  });
};

const sendWelcomeEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #0f0f1a; color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #ffd700; }
        .content { background: #1a1a2e; border-radius: 12px; padding: 30px; }
        .button { display: inline-block; background: linear-gradient(135deg, #2ed573, #26a65b); color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b6b80; font-size: 12px; }
        .feature { display: flex; align-items: center; margin: 15px 0; }
        .feature-icon { font-size: 24px; margin-right: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏁 BitWinner</div>
        </div>
        <div class="content">
          <h2>Welcome to BitWinner! 🎉</h2>
          <p>Hi ${user.username},</p>
          <p>Your email has been verified and your account is now active. You're ready to start playing!</p>
          
          <h3>How to Play:</h3>
          <div class="feature">
            <span class="feature-icon">🎫</span>
            <span>Buy tickets for Red or Green team (or both!)</span>
          </div>
          <div class="feature">
            <span class="feature-icon">⏱️</span>
            <span>Each race lasts 10 seconds</span>
          </div>
          <div class="feature">
            <span class="feature-icon">🏆</span>
            <span>Team with more tickets wins</span>
          </div>
          <div class="feature">
            <span class="feature-icon">💰</span>
            <span>Winners split the losing team's pool</span>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL}" class="button">Start Playing</a>
          </div>
          
          <p>Good luck and have fun!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} BitWinner. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: user.email,
    subject: 'Welcome to BitWinner! 🎉',
    html,
    text: `Welcome to BitWinner, ${user.username}! Your account is now active. Visit ${process.env.FRONTEND_URL} to start playing!`
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
