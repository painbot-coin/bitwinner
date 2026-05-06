const API_URL = import.meta.env.VITE_API_URL || '';

class ApiService {
  constructor() {
    this.accessToken = null;
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      const err = new Error(data.message || 'Request failed');
      err.status = response.status;
      err.errors = data.errors; // validation errors array
      throw err;
    }

    return data;
  }

  // Auth endpoints
  async signup(email, username, password) {
    return this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
  }

  async signin(email, password) {
    return this.request('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async googleAuth(credential) {
    return this.request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }

  async signout() {
    return this.request('/api/auth/signout', { method: 'POST' });
  }

  async signoutAll() {
    return this.request('/api/auth/signout-all', { method: 'POST' });
  }

  async refreshToken() {
    return this.request('/api/auth/refresh', { method: 'POST' });
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  async resendVerification() {
    return this.request('/api/auth/resend-verification', { method: 'POST' });
  }

  async forgotPassword(email) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token, password) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getSessions() {
    return this.request('/api/auth/sessions');
  }

  async revokeSession(sessionId) {
    return this.request(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
  }

  // User endpoints
  async getProfile() {
    return this.request('/api/user/me');
  }

  async updateProfile(data) {
    return this.request('/api/user/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getTransactions(limit = 50) {
    return this.request(`/api/user/transactions?limit=${limit}`);
  }

  async getStats() {
    return this.request('/api/user/stats');
  }

  // Wallet endpoints
  async getNetworks() {
    return this.request('/api/wallet/networks');
  }

  async getDepositAddress(network) {
    return this.request(`/api/wallet/deposit-address?network=${network}`);
  }

  async getDeposits(page = 1, limit = 20) {
    return this.request(`/api/wallet/deposits?page=${page}&limit=${limit}`);
  }

  async requestWithdrawal(network, amount, toAddress) {
    return this.request('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ network, amount, toAddress }),
    });
  }

  async getWithdrawals(page = 1, limit = 20) {
    return this.request(`/api/wallet/withdrawals?page=${page}&limit=${limit}`);
  }

  async cancelWithdrawal(withdrawalId) {
    return this.request(`/api/wallet/withdrawals/${withdrawalId}`, { method: 'DELETE' });
  }

  async getWalletSummary() {
    return this.request('/api/wallet/summary');
  }

  // Config
  async getConfig() {
    return this.request('/api/config');
  }
}

export const api = new ApiService();
export default api;
