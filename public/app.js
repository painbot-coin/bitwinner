// Socket.IO connection
const socket = io();

// App State
const state = {
  user: null,
  accessToken: null,
  raceNumber: null,
  status: 'betting',
  ticketPrice: 1
};

// DOM Elements
const elements = {
  authButtons: document.getElementById('authButtons'),
  userSection: document.getElementById('userSection'),
  balance: document.getElementById('balance'),
  username: document.getElementById('username'),
  userAvatar: document.getElementById('userAvatar'),
  userDropdown: document.getElementById('userDropdown'),
  raceId: document.getElementById('raceId'),
  timer: document.querySelector('.timer-value'),
  timerProgress: document.getElementById('timerProgress'),
  statusBadge: document.getElementById('statusBadge'),
  redTickets: document.getElementById('redTickets'),
  greenTickets: document.getElementById('greenTickets'),
  redTotalTickets: document.getElementById('redTotalTickets'),
  greenTotalTickets: document.getElementById('greenTotalTickets'),
  redPool: document.getElementById('redPool'),
  greenPool: document.getElementById('greenPool'),
  redTicketInput: document.getElementById('redTicketInput'),
  greenTicketInput: document.getElementById('greenTicketInput'),
  summaryRed: document.getElementById('summaryRed'),
  summaryGreen: document.getElementById('summaryGreen'),
  totalCost: document.getElementById('totalCost'),
  placeBetBtn: document.getElementById('placeBetBtn'),
  loginPrompt: document.getElementById('loginPrompt'),
  redRacer: document.getElementById('redRacer'),
  greenRacer: document.getElementById('greenRacer'),
  winnerOverlay: document.getElementById('winnerOverlay'),
  winnerIcon: document.getElementById('winnerIcon'),
  winnerText: document.getElementById('winnerText'),
  winnerPayout: document.getElementById('winnerPayout'),
  historyList: document.getElementById('historyList'),
  toastContainer: document.getElementById('toastContainer'),
  ticketPriceDisplay: document.getElementById('ticketPriceDisplay'),
  depositBalance: document.getElementById('depositBalance')
};

// Google Client ID - fetched from server config
let GOOGLE_CLIENT_ID = null;

// Initialize Google Sign-In
async function initGoogleSignIn() {
  // First, fetch the Google Client ID from server
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    GOOGLE_CLIENT_ID = config.googleClientId;
  } catch (e) {
    console.log('Could not fetch config');
  }
  
  // If no valid Google Client ID, hide Google buttons and return
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('your-google') || GOOGLE_CLIENT_ID === 'undefined') {
    const signinContainer = document.getElementById('googleSignInBtn');
    const signupContainer = document.getElementById('googleSignUpBtn');
    if (signinContainer) signinContainer.style.display = 'none';
    if (signupContainer) signupContainer.style.display = 'none';
    
    // Also hide the dividers
    document.querySelectorAll('.auth-divider').forEach(el => el.style.display = 'none');
    return;
  }
  
  if (typeof google === 'undefined') {
    setTimeout(initGoogleSignIn, 100);
    return;
  }
  
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false
  });
  
  // Render Google buttons
  const signinContainer = document.getElementById('googleSignInBtn');
  const signupContainer = document.getElementById('googleSignUpBtn');
  
  if (signinContainer) {
    google.accounts.id.renderButton(signinContainer, {
      theme: 'filled_black',
      size: 'large',
      width: 300,
      text: 'signin_with'
    });
  }
  
  if (signupContainer) {
    google.accounts.id.renderButton(signupContainer, {
      theme: 'filled_black',
      size: 'large',
      width: 300,
      text: 'signup_with'
    });
  }
}

// Handle Google credential
async function handleGoogleCredential(response) {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.user = data.user;
      state.accessToken = data.accessToken;
      updateUIForLoggedInUser();
      closeAllModals();
      showToast('Signed in with Google successfully!', 'success');
      socket.emit('authenticate', data.accessToken);
    } else {
      showToast(data.message || 'Google sign-in failed', 'error');
    }
  } catch (error) {
    console.error('Google auth error:', error);
    showToast('Failed to sign in with Google', 'error');
  }
}

// Socket Events
socket.on('init', (data) => {
  if (data.user) {
    state.user = data.user;
    updateUIForLoggedInUser();
  }
  
  state.raceNumber = data.raceNumber;
  state.status = data.status;
  state.ticketPrice = data.ticketPrice;
  
  updateRaceId(data.raceNumber);
  updateTicketCounts(data.redTickets, data.greenTickets, data.redPool, data.greenPool);
  updateHistory(data.history);
  elements.ticketPriceDisplay.textContent = `${data.ticketPrice} USDT`;
});

socket.on('authenticated', (data) => {
  state.user = data.user;
  updateUIForLoggedInUser();
});

socket.on('gameState', (data) => {
  state.status = data.status;
  state.ticketPrice = data.ticketPrice;
  updateTimer(data.timeRemaining);
  updateStatus(data.status);
  updateTicketCounts(data.redTickets, data.greenTickets, data.redPool, data.greenPool);
});

socket.on('newRace', (data) => {
  state.raceNumber = data.raceNumber;
  state.status = 'betting';
  updateRaceId(data.raceNumber);
  resetRacers();
  hideWinnerOverlay();
  updateBetButton();
  showToast('New race started! Place your bets!', 'info');
});

socket.on('raceStarted', (data) => {
  state.status = 'racing';
  updateBetButton();
  startRaceAnimation();
});

socket.on('raceEnded', (results) => {
  state.status = 'finished';
  showWinnerOverlay(results);
  updateHistory([{
    raceNumber: results.raceNumber,
    winner: results.winner,
    redTickets: results.redTickets,
    greenTickets: results.greenTickets
  }], true);
});

socket.on('ticketUpdate', (data) => {
  updateTicketCounts(data.redTickets, data.greenTickets, data.redPool, data.greenPool);
});

socket.on('walletUpdate', (data) => {
  if (state.user) {
    state.user.balance = data.balance;
    state.user.stats = data.stats;
    updateBalance(data.balance);
  }
});

socket.on('purchaseConfirmed', (data) => {
  showToast(`Purchased ${data.redTickets + data.greenTickets} tickets!`, 'success');
  clearInputs();
  if (state.user) {
    state.user.balance = data.newBalance;
    updateBalance(data.newBalance);
  }
});

socket.on('error', (data) => {
  showToast(data.message, 'error');
});

// Auth Functions
async function handleSignIn(event) {
  event.preventDefault();
  
  const email = document.getElementById('signinEmail').value;
  const password = document.getElementById('signinPassword').value;
  const btn = document.getElementById('signinBtn');
  
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';
  
  try {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.user = data.user;
      state.accessToken = data.accessToken;
      updateUIForLoggedInUser();
      closeModal('signinModal');
      showToast('Signed in successfully!', 'success');
      socket.emit('authenticate', data.accessToken);
    } else {
      showToast(data.message || 'Sign in failed', 'error');
    }
  } catch (error) {
    console.error('Sign in error:', error);
    showToast('Failed to sign in', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleSignUp(event) {
  event.preventDefault();
  
  const email = document.getElementById('signupEmail').value;
  const username = document.getElementById('signupUsername').value;
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirmPassword').value;
  const btn = document.getElementById('signupBtn');
  
  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';
  
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password, confirmPassword }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.user = data.user;
      state.accessToken = data.accessToken;
      updateUIForLoggedInUser();
      closeModal('signupModal');
      showToast('Account created! Check your email to verify.', 'success');
      socket.emit('authenticate', data.accessToken);
    } else {
      if (data.errors) {
        showToast(data.errors[0].message, 'error');
      } else {
        showToast(data.message || 'Sign up failed', 'error');
      }
    }
  } catch (error) {
    console.error('Sign up error:', error);
    showToast('Failed to create account', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  
  const email = document.getElementById('forgotEmail').value;
  
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    const data = await res.json();
    showToast(data.message, 'success');
    closeModal('forgotPasswordModal');
  } catch (error) {
    showToast('Failed to send reset email', 'error');
  }
}

async function signOut() {
  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Sign out error:', error);
  }
  
  state.user = null;
  state.accessToken = null;
  updateUIForLoggedOutUser();
  showToast('Signed out successfully', 'info');
  toggleUserDropdown();
}

// UI Update Functions
function updateUIForLoggedInUser() {
  elements.authButtons.style.display = 'none';
  elements.userSection.style.display = 'flex';
  elements.loginPrompt.style.display = 'none';
  
  updateBalance(state.user.balance);
  elements.username.textContent = state.user.username;
  elements.userAvatar.textContent = state.user.username.charAt(0).toUpperCase();
  
  // Show/hide email verification banner
  updateEmailVerificationBanner();
  
  updateBetButton();
}

function updateUIForLoggedOutUser() {
  elements.authButtons.style.display = 'flex';
  elements.userSection.style.display = 'none';
  elements.loginPrompt.style.display = 'block';
  elements.placeBetBtn.disabled = true;
  
  // Hide verification banner
  const banner = document.getElementById('emailVerificationBanner');
  if (banner) banner.style.display = 'none';
}

function updateEmailVerificationBanner() {
  let banner = document.getElementById('emailVerificationBanner');
  
  if (!state.user) {
    if (banner) banner.style.display = 'none';
    return;
  }
  
  if (state.user.isEmailVerified) {
    if (banner) banner.style.display = 'none';
    return;
  }
  
  // Create banner if it doesn't exist
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'emailVerificationBanner';
    banner.className = 'email-verification-banner';
    banner.innerHTML = `
      <div class="banner-content">
        <span class="banner-icon">📧</span>
        <span class="banner-text">Please verify your email to place bets and withdraw funds.</span>
        <button class="banner-btn" onclick="resendVerificationEmail()">Resend Email</button>
        <button class="banner-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
      </div>
    `;
    document.querySelector('.game-container').prepend(banner);
  }
  
  banner.style.display = 'block';
}

async function resendVerificationEmail() {
  try {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Verification email sent! Check your inbox.', 'success');
    } else {
      showToast(data.message || 'Failed to send email', 'error');
    }
  } catch (error) {
    showToast('Failed to send verification email', 'error');
  }
}

function updateBalance(balance) {
  elements.balance.textContent = balance.toFixed(2);
  if (elements.depositBalance) {
    elements.depositBalance.textContent = balance.toFixed(2);
  }
}

function updateRaceId(raceNumber) {
  elements.raceId.textContent = '#' + String(raceNumber).padStart(6, '0');
}

function updateTimer(timeRemaining) {
  const seconds = (timeRemaining / 1000).toFixed(1);
  elements.timer.textContent = seconds;
  
  const progress = (timeRemaining / 10000) * 100;
  elements.timerProgress.style.width = progress + '%';
  
  if (timeRemaining < 3000) {
    elements.timer.style.color = '#ff4757';
  } else {
    elements.timer.style.color = '#ffd700';
  }
}

function updateStatus(status) {
  const badge = elements.statusBadge;
  badge.className = 'status-badge';
  
  switch (status) {
    case 'betting':
      badge.textContent = 'BETTING OPEN';
      break;
    case 'racing':
      badge.textContent = 'RACING...';
      badge.classList.add('racing');
      break;
    case 'finished':
      badge.textContent = 'FINISHED';
      badge.classList.add('finished');
      break;
  }
}

function updateTicketCounts(red, green, redPool, greenPool) {
  elements.redTickets.textContent = red;
  elements.greenTickets.textContent = green;
  elements.redTotalTickets.textContent = red;
  elements.greenTotalTickets.textContent = green;
  elements.redPool.textContent = redPool?.toFixed(0) || '0';
  elements.greenPool.textContent = greenPool?.toFixed(0) || '0';
}

// History state
const historyState = {
  races: [],
  redWins: 0,
  greenWins: 0
};

function updateHistory(history, prepend = false) {
  // Remove empty state if exists
  const emptyState = elements.historyList.querySelector('.history-empty');
  if (emptyState && history.length > 0) {
    emptyState.remove();
  }
  
  if (prepend && history.length > 0) {
    const item = history[0];
    const historyItem = createHistoryItem(item, true);
    elements.historyList.insertBefore(historyItem, elements.historyList.firstChild);
    
    // Update stats
    if (item.winner === 'red') historyState.redWins++;
    else if (item.winner === 'green') historyState.greenWins++;
    
    // Add to state
    historyState.races.unshift(item);
    
    // Limit to 20 items
    while (elements.historyList.children.length > 20) {
      elements.historyList.removeChild(elements.historyList.lastChild);
    }
    if (historyState.races.length > 20) {
      historyState.races.pop();
    }
    
    // Scroll to start to show new item
    elements.historyList.scrollLeft = 0;
  } else {
    elements.historyList.innerHTML = '';
    historyState.races = [];
    historyState.redWins = 0;
    historyState.greenWins = 0;
    
    if (history.length === 0) {
      elements.historyList.innerHTML = `
        <div class="history-empty">
          <span class="empty-icon">🏁</span>
          <span>No races yet</span>
        </div>
      `;
    } else {
      history.forEach(item => {
        elements.historyList.appendChild(createHistoryItem(item, false));
        historyState.races.push(item);
        if (item.winner === 'red') historyState.redWins++;
        else if (item.winner === 'green') historyState.greenWins++;
      });
    }
  }
  
  // Update win counters
  updateHistoryStats();
}

function updateHistoryStats() {
  const redWinsEl = document.getElementById('historyRedWins');
  const greenWinsEl = document.getElementById('historyGreenWins');
  
  if (redWinsEl) redWinsEl.textContent = historyState.redWins;
  if (greenWinsEl) greenWinsEl.textContent = historyState.greenWins;
}

function createHistoryItem(item, isNew = false) {
  const div = document.createElement('div');
  div.className = `history-item ${item.winner || 'tie'}${isNew ? ' new' : ''}`;
  
  let icon = '🏁';
  let winnerLabel = 'TIE';
  if (item.winner === 'red') {
    icon = '🔴';
    winnerLabel = 'RED';
  } else if (item.winner === 'green') {
    icon = '🟢';
    winnerLabel = 'GREEN';
  } else if (item.winner === 'tie') {
    icon = '🤝';
    winnerLabel = 'TIE';
  }
  
  const totalPool = (item.redTickets + item.greenTickets) * state.ticketPrice;
  const raceNum = String(item.raceNumber).padStart(6, '0');
  
  div.innerHTML = `
    <div class="history-race-num">#${raceNum}</div>
    <div class="history-winner-icon">${icon}</div>
    <div class="history-scores">
      <span class="red-score">${item.redTickets}</span>
      <span class="vs">vs</span>
      <span class="green-score">${item.greenTickets}</span>
    </div>
    <div class="history-pool"><span>${totalPool.toFixed(0)}</span> USDT</div>
    <div class="history-tooltip">
      <div class="tooltip-title">Race #${raceNum}</div>
      <div class="tooltip-row">
        <span>Winner</span>
        <span>${winnerLabel}</span>
      </div>
      <div class="tooltip-row red">
        <span>Red Tickets</span>
        <span>${item.redTickets}</span>
      </div>
      <div class="tooltip-row green">
        <span>Green Tickets</span>
        <span>${item.greenTickets}</span>
      </div>
      <div class="tooltip-row pool">
        <span>Total Pool</span>
        <span>${totalPool.toFixed(2)} USDT</span>
      </div>
    </div>
  `;
  
  return div;
}

// Racing Animation
function startRaceAnimation() {
  elements.redRacer.classList.add('racing');
  elements.greenRacer.classList.add('racing');
}

function resetRacers() {
  elements.redRacer.classList.remove('racing', 'winner');
  elements.greenRacer.classList.remove('racing', 'winner');
  elements.redRacer.style.left = '10px';
  elements.greenRacer.style.left = '10px';
}

// Winner Overlay
function showWinnerOverlay(results) {
  const overlay = elements.winnerOverlay;
  const icon = elements.winnerIcon;
  const text = elements.winnerText;
  const payout = elements.winnerPayout;
  
  text.className = 'winner-text';
  
  if (results.winner === 'red') {
    icon.textContent = '🔴';
    text.textContent = 'RED TEAM WINS!';
    text.classList.add('red');
    elements.redRacer.classList.add('winner');
  } else if (results.winner === 'green') {
    icon.textContent = '🟢';
    text.textContent = 'GREEN TEAM WINS!';
    text.classList.add('green');
    elements.greenRacer.classList.add('winner');
  } else {
    icon.textContent = '🤝';
    text.textContent = "IT'S A TIE!";
    text.classList.add('tie');
  }
  
  const userPayout = results.payouts?.find(p => 
    state.user && p.oderId === state.user.id
  );
  
  if (userPayout) {
    payout.textContent = `You won ${userPayout.winnings} USDT!`;
    payout.style.color = '#2ed573';
  } else {
    payout.textContent = `${results.redTickets} vs ${results.greenTickets} tickets`;
    payout.style.color = '#a0a0b0';
  }
  
  overlay.classList.add('show');
}

function hideWinnerOverlay() {
  elements.winnerOverlay.classList.remove('show');
}

// Ticket Input Functions
function adjustTickets(team, delta) {
  const input = team === 'red' ? elements.redTicketInput : elements.greenTicketInput;
  let value = parseInt(input.value) || 0;
  value = Math.max(0, value + delta);
  input.value = value;
  updateSummary();
}

function setTickets(team, amount) {
  const input = team === 'red' ? elements.redTicketInput : elements.greenTicketInput;
  
  if (amount === 'max' && state.user) {
    const otherInput = team === 'red' ? elements.greenTicketInput : elements.redTicketInput;
    const otherValue = parseInt(otherInput.value) || 0;
    const otherCost = otherValue * state.ticketPrice;
    const availableBalance = state.user.balance - otherCost;
    amount = Math.floor(availableBalance / state.ticketPrice);
  } else if (amount === 'max') {
    amount = 0;
  }
  
  input.value = Math.max(0, amount);
  updateSummary();
}

function updateSummary() {
  const redTickets = parseInt(elements.redTicketInput.value) || 0;
  const greenTickets = parseInt(elements.greenTicketInput.value) || 0;
  const totalCost = (redTickets + greenTickets) * state.ticketPrice;
  
  elements.summaryRed.textContent = redTickets;
  elements.summaryGreen.textContent = greenTickets;
  elements.totalCost.textContent = totalCost.toFixed(0) + ' USDT';
  
  updateBetButton();
}

function updateBetButton() {
  const redTickets = parseInt(elements.redTicketInput.value) || 0;
  const greenTickets = parseInt(elements.greenTicketInput.value) || 0;
  const totalCost = (redTickets + greenTickets) * state.ticketPrice;
  
  const canBet = state.user && 
                 totalCost > 0 && 
                 totalCost <= state.user.balance && 
                 state.status === 'betting';
  
  elements.placeBetBtn.disabled = !canBet;
}

function clearInputs() {
  elements.redTicketInput.value = 0;
  elements.greenTicketInput.value = 0;
  updateSummary();
}

// Place Bet
function placeBet() {
  if (!state.user) {
    openModal('signinModal');
    return;
  }
  
  const redTickets = parseInt(elements.redTicketInput.value) || 0;
  const greenTickets = parseInt(elements.greenTicketInput.value) || 0;
  
  if (redTickets === 0 && greenTickets === 0) {
    showToast('Please select at least 1 ticket', 'error');
    return;
  }
  
  socket.emit('buyTickets', { redTickets, greenTickets });
}

// ==================== WALLET FUNCTIONALITY ====================

// Wallet state
const walletState = {
  selectedDepositNetwork: 'tron',
  selectedWithdrawNetwork: 'tron',
  depositAddress: null,
  networks: {
    tron: { fee: 1, minWithdraw: 20 },
    bsc: { fee: 0.5, minWithdraw: 20 },
    ethereum: { fee: 5, minWithdraw: 20 }
  }
};

// Switch wallet tabs
function switchWalletTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.wallet-tab').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.wallet-tab[onclick="switchWalletTab('${tab}')"]`).classList.add('active');
  
  // Show/hide content
  document.getElementById('depositTab').style.display = tab === 'deposit' ? 'block' : 'none';
  document.getElementById('withdrawTab').style.display = tab === 'withdraw' ? 'block' : 'none';
  document.getElementById('historyTab').style.display = tab === 'history' ? 'block' : 'none';
  
  // Load data for tab
  if (tab === 'deposit') {
    loadDepositAddress(walletState.selectedDepositNetwork);
  } else if (tab === 'withdraw') {
    updateWithdrawInfo();
  } else if (tab === 'history') {
    loadWalletHistory();
  }
}

// Select deposit network
function selectNetwork(network) {
  walletState.selectedDepositNetwork = network;
  
  // Update UI
  document.querySelectorAll('#depositTab .network-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.network === network);
  });
  
  loadDepositAddress(network);
}

// Load deposit address for network
async function loadDepositAddress(network) {
  const loadingEl = document.getElementById('depositLoading');
  const contentEl = document.getElementById('depositAddressContent');
  
  loadingEl.style.display = 'flex';
  contentEl.style.display = 'none';
  
  try {
    const res = await fetch(`/api/wallet/deposit-address?network=${network}`, {
      headers: { 'Authorization': `Bearer ${state.accessToken}` },
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      walletState.depositAddress = data.address;
      
      // Update QR code
      document.getElementById('depositQRCode').innerHTML = `<img src="${data.qrCode}" alt="Deposit QR Code">`;
      
      // Update address
      document.getElementById('depositAddressInput').value = data.address;
      document.getElementById('minDepositAmount').textContent = data.minDeposit;
      
      loadingEl.style.display = 'none';
      contentEl.style.display = 'flex';
    } else {
      showToast(data.message || 'Failed to get deposit address', 'error');
      loadingEl.innerHTML = `<span style="color: var(--red);">Failed to load address</span>`;
    }
  } catch (error) {
    console.error('Load deposit address error:', error);
    loadingEl.innerHTML = `<span style="color: var(--red);">Failed to load address</span>`;
  }
}

// Copy deposit address
function copyDepositAddress() {
  const address = document.getElementById('depositAddressInput').value;
  navigator.clipboard.writeText(address).then(() => {
    showToast('Address copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy address', 'error');
  });
}

// Select withdraw network
function selectWithdrawNetwork(network) {
  walletState.selectedWithdrawNetwork = network;
  
  // Update UI
  document.querySelectorAll('#withdrawTab .network-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.network === network);
  });
  
  updateWithdrawInfo();
}

// Update withdraw info
function updateWithdrawInfo() {
  const network = walletState.selectedWithdrawNetwork;
  const networkInfo = walletState.networks[network];
  
  document.getElementById('minWithdrawAmount').textContent = networkInfo.minWithdraw;
  document.getElementById('withdrawFee').textContent = networkInfo.fee;
  
  // Calculate receive amount
  const amount = parseFloat(document.getElementById('withdrawAmount').value) || 0;
  const receive = Math.max(0, amount - networkInfo.fee);
  document.getElementById('withdrawReceive').textContent = receive.toFixed(2);
}

// Set max withdrawal amount
function setMaxWithdraw() {
  if (!state.user) return;
  
  const fee = walletState.networks[walletState.selectedWithdrawNetwork].fee;
  const maxAmount = Math.max(0, state.user.balance);
  document.getElementById('withdrawAmount').value = maxAmount.toFixed(2);
  updateWithdrawInfo();
}

// Request withdrawal
async function requestWithdrawal() {
  if (!state.user) {
    showToast('Please sign in first', 'error');
    return;
  }
  
  const network = walletState.selectedWithdrawNetwork;
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const toAddress = document.getElementById('withdrawAddress').value.trim();
  
  if (!toAddress) {
    showToast('Please enter withdrawal address', 'error');
    return;
  }
  
  if (!amount || amount < walletState.networks[network].minWithdraw) {
    showToast(`Minimum withdrawal is ${walletState.networks[network].minWithdraw} USDT`, 'error');
    return;
  }
  
  if (amount > state.user.balance) {
    showToast('Insufficient balance', 'error');
    return;
  }
  
  try {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`
      },
      body: JSON.stringify({ network, amount, toAddress }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.user.balance = data.newBalance;
      updateBalance(data.newBalance);
      showToast('Withdrawal request submitted!', 'success');
      
      // Clear form
      document.getElementById('withdrawAmount').value = '';
      document.getElementById('withdrawAddress').value = '';
      updateWithdrawInfo();
      
      // Reload history
      loadWalletHistory();
    } else {
      showToast(data.message || 'Withdrawal failed', 'error');
    }
  } catch (error) {
    showToast('Failed to process withdrawal', 'error');
  }
}

// Load wallet history
async function loadWalletHistory() {
  const list = document.getElementById('walletHistoryList');
  const filter = document.getElementById('historyFilter').value;
  
  list.innerHTML = '<p class="empty-state">Loading...</p>';
  
  try {
    let deposits = [];
    let withdrawals = [];
    
    if (filter === 'all' || filter === 'deposits') {
      const depRes = await fetch('/api/wallet/deposits?limit=20', {
        headers: { 'Authorization': `Bearer ${state.accessToken}` },
        credentials: 'include'
      });
      const depData = await depRes.json();
      if (depData.success) {
        deposits = depData.deposits.map(d => ({ ...d, type: 'deposit' }));
      }
    }
    
    if (filter === 'all' || filter === 'withdrawals') {
      const withRes = await fetch('/api/wallet/withdrawals?limit=20', {
        headers: { 'Authorization': `Bearer ${state.accessToken}` },
        credentials: 'include'
      });
      const withData = await withRes.json();
      if (withData.success) {
        withdrawals = withData.withdrawals.map(w => ({ ...w, type: 'withdrawal' }));
      }
    }
    
    // Combine and sort by date
    const transactions = [...deposits, ...withdrawals]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (transactions.length === 0) {
      list.innerHTML = '<p class="empty-state">No transactions yet</p>';
      return;
    }
    
    list.innerHTML = '';
    transactions.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const isDeposit = tx.type === 'deposit';
      const networkNames = { tron: 'TRON', bsc: 'BSC', ethereum: 'ETH' };
      
      item.innerHTML = `
        <div class="history-item-left">
          <div class="history-icon ${tx.type}">${isDeposit ? '📥' : '📤'}</div>
          <div class="history-details">
            <span class="history-type">${isDeposit ? 'Deposit' : 'Withdrawal'}</span>
            <span class="history-network">${networkNames[tx.network] || tx.network}</span>
          </div>
        </div>
        <div class="history-item-right">
          <span class="history-amount ${isDeposit ? 'positive' : 'negative'}">
            ${isDeposit ? '+' : '-'}${tx.amount.toFixed(2)} USDT
          </span>
          <span class="history-status ${tx.status}">${tx.status}</span>
        </div>
      `;
      
      // Add click handler for tx hash
      if (tx.txHash && tx.explorerUrl) {
        item.style.cursor = 'pointer';
        item.onclick = () => window.open(tx.explorerUrl, '_blank');
      }
      
      list.appendChild(item);
    });
  } catch (error) {
    list.innerHTML = '<p class="empty-state">Failed to load history</p>';
  }
}

// Listen for withdraw amount changes
document.addEventListener('DOMContentLoaded', () => {
  const withdrawAmountInput = document.getElementById('withdrawAmount');
  if (withdrawAmountInput) {
    withdrawAmountInput.addEventListener('input', updateWithdrawInfo);
  }
});

// Socket events for wallet updates
socket.on('depositDetected', (data) => {
  showToast(`Deposit detected: ${data.amount} USDT (confirming...)`, 'info');
});

socket.on('depositConfirming', (data) => {
  showToast(`Deposit: ${data.confirmations}/${data.requiredConfirmations} confirmations`, 'info');
});

socket.on('depositCompleted', (data) => {
  state.user.balance = data.newBalance;
  updateBalance(data.newBalance);
  showToast(`Deposit completed: +${data.amount} USDT`, 'success');
});

socket.on('withdrawalProcessing', (data) => {
  showToast(`Withdrawal processing: ${data.amount} USDT`, 'info');
});

socket.on('withdrawalCompleted', (data) => {
  showToast(`Withdrawal completed: ${data.amount} USDT`, 'success');
});

socket.on('withdrawalFailed', (data) => {
  if (data.refunded) {
    state.user.balance = data.newBalance;
    updateBalance(data.newBalance);
    showToast(`Withdrawal failed and refunded: ${data.amount} USDT`, 'warning');
  } else {
    showToast(`Withdrawal failed: ${data.reason}`, 'error');
  }
});

// Legacy deposit function (demo mode fallback)
async function deposit(amount) {
  if (!state.user) {
    showToast('Please sign in first', 'error');
    return;
  }
  
  try {
    const res = await fetch('/api/user/deposit', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`
      },
      body: JSON.stringify({ amount }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.user.balance = data.balance;
      updateBalance(data.balance);
      showToast(`Deposited ${amount} USDT successfully!`, 'success');
      closeModal('depositModal');
    } else {
      showToast(data.message || 'Deposit failed', 'error');
    }
  } catch (error) {
    showToast('Failed to process deposit', 'error');
  }
}

function depositCustom() {
  const amount = parseFloat(document.getElementById('customDepositAmount').value);
  if (amount && amount > 0 && amount <= 10000) {
    deposit(amount);
  } else {
    showToast('Please enter a valid amount (1-10000)', 'error');
  }
}

// Load Transactions
async function loadTransactions() {
  if (!state.user) return;
  
  const list = document.getElementById('transactionsList');
  list.innerHTML = '<p class="empty-state">Loading...</p>';
  
  try {
    const res = await fetch('/api/user/transactions?limit=50', {
      headers: { 'Authorization': `Bearer ${state.accessToken}` },
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success && data.transactions.length > 0) {
      list.innerHTML = '';
      data.transactions.forEach(tx => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        
        const icons = {
          deposit: '💰',
          withdrawal: '📤',
          bet: '🎰',
          win: '🏆',
          refund: '↩️',
          bonus: '🎁'
        };
        
        const isPositive = tx.amount > 0;
        
        item.innerHTML = `
          <div class="transaction-info">
            <div class="transaction-icon ${tx.type}">${icons[tx.type] || '📝'}</div>
            <div class="transaction-details">
              <h4>${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</h4>
              <p>${tx.description || ''} • ${new Date(tx.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
            ${isPositive ? '+' : ''}${tx.amount.toFixed(2)} USDT
          </div>
        `;
        
        list.appendChild(item);
      });
    } else {
      list.innerHTML = '<p class="empty-state">No transactions yet</p>';
    }
  } catch (error) {
    list.innerHTML = '<p class="empty-state">Failed to load transactions</p>';
  }
}

// Update Profile Modal
function updateProfileModal() {
  if (!state.user) return;
  
  document.getElementById('profileUsername').textContent = state.user.username;
  document.getElementById('profileEmail').textContent = state.user.email;
  document.getElementById('profileAvatar').textContent = state.user.username.charAt(0).toUpperCase();
  document.getElementById('statBalance').textContent = state.user.balance.toFixed(2);
  document.getElementById('statGames').textContent = state.user.stats?.gamesPlayed || 0;
  document.getElementById('statWins').textContent = state.user.stats?.wins || 0;
  
  const profit = (state.user.stats?.totalWon || 0) - (state.user.stats?.totalLost || 0);
  const profitEl = document.getElementById('statProfit');
  profitEl.textContent = profit.toFixed(2);
  profitEl.style.color = profit >= 0 ? '#2ed573' : '#ff4757';
  
  // Update email verification badge
  const badge = document.getElementById('emailVerifiedBadge');
  if (state.user.isEmailVerified) {
    badge.textContent = '✓ Verified';
    badge.className = 'email-badge verified';
  } else {
    badge.textContent = '⚠ Unverified';
    badge.className = 'email-badge unverified';
  }
  
  // Load active sessions
  loadSessions();
}

// ==================== SESSION MANAGEMENT ====================

async function loadSessions() {
  const list = document.getElementById('sessionsList');
  list.innerHTML = '<p class="empty-state">Loading sessions...</p>';
  
  try {
    const res = await fetch('/api/auth/sessions', {
      headers: { 'Authorization': `Bearer ${state.accessToken}` },
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success && data.sessions.length > 0) {
      list.innerHTML = '';
      
      data.sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `session-item ${session.isCurrent ? 'current' : ''}`;
        
        // Device icon based on type
        const deviceIcons = {
          'Desktop': '🖥️',
          'Mobile': '📱',
          'Tablet': '📱'
        };
        
        const icon = deviceIcons[session.device] || '💻';
        const date = new Date(session.createdAt).toLocaleDateString();
        
        item.innerHTML = `
          <div class="session-info">
            <div class="session-icon">${icon}</div>
            <div class="session-details">
              <span class="session-device">
                ${session.browser} on ${session.os}
                ${session.isCurrent ? '<span class="session-current-badge">Current</span>' : ''}
              </span>
              <span class="session-meta">${session.ip} • ${date}</span>
            </div>
          </div>
          ${!session.isCurrent ? `
            <button class="session-revoke" onclick="revokeSession('${session.id}')">
              Revoke
            </button>
          ` : ''}
        `;
        
        list.appendChild(item);
      });
    } else {
      list.innerHTML = '<p class="empty-state">No active sessions</p>';
    }
  } catch (error) {
    list.innerHTML = '<p class="empty-state">Failed to load sessions</p>';
  }
}

async function revokeSession(sessionId) {
  if (!confirm('Are you sure you want to revoke this session?')) return;
  
  try {
    const res = await fetch(`/api/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.accessToken}` },
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Session revoked successfully', 'success');
      loadSessions();
    } else {
      showToast(data.message || 'Failed to revoke session', 'error');
    }
  } catch (error) {
    showToast('Failed to revoke session', 'error');
  }
}

async function signOutAllSessions() {
  if (!confirm('This will sign you out from all devices including this one. Continue?')) return;
  
  try {
    const res = await fetch('/api/auth/signout-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.accessToken}` },
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Signed out from all devices', 'success');
      state.user = null;
      state.accessToken = null;
      updateUIForLoggedOutUser();
      closeModal('profileModal');
    } else {
      showToast(data.message || 'Failed to sign out', 'error');
    }
  } catch (error) {
    showToast('Failed to sign out from all devices', 'error');
  }
}

async function changePassword(event) {
  event.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  
  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', 'error');
    return;
  }
  
  if (newPassword.length < 8) {
    showToast('Password must be at least 8 characters', 'error');
    return;
  }
  
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`
      },
      body: JSON.stringify({ currentPassword, newPassword }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Password changed successfully', 'success');
      closeModal('changePasswordModal');
      
      // Clear form
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmNewPassword').value = '';
    } else {
      showToast(data.message || 'Failed to change password', 'error');
    }
  } catch (error) {
    showToast('Failed to change password', 'error');
  }
}

// Modal Functions
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
  
  if (modalId === 'depositModal') {
    elements.depositBalance.textContent = state.user?.balance.toFixed(2) || '0';
    // Initialize wallet - load deposit address for default network
    loadDepositAddress(walletState.selectedDepositNetwork);
  }
  
  if (modalId === 'profileModal') {
    updateProfileModal();
  }
  
  if (modalId === 'transactionsModal') {
    loadTransactions();
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('show');
  });
}

function toggleUserDropdown() {
  elements.userDropdown.classList.toggle('show');
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    info: '🔔',
    warning: '⚠️'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Event Listeners
elements.redTicketInput.addEventListener('input', updateSummary);
elements.greenTicketInput.addEventListener('input', updateSummary);

// Close modals on outside click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show');
    }
  });
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu')) {
    elements.userDropdown.classList.remove('show');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllModals();
    elements.userDropdown.classList.remove('show');
  }
});

// Initialize
updateSummary();
initGoogleSignIn();

// Check for existing session
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        state.user = data.user;
        updateUIForLoggedInUser();
      }
    }
  } catch (error) {
    console.log('No existing session');
  }
}

checkSession();
