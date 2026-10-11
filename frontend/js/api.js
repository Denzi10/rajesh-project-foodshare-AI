/**
 * FoodShare AI - API Client Module
 */

const API = {
  async request(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(`/api${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || `Request failed with status ${response.status}`);
        error.statusCode = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth API
  auth: {
    register: (payload) => API.request('/auth/register', { method: 'POST', body: payload }),
    login: (credentials) => API.request('/auth/login', { method: 'POST', body: credentials }),
    logout: () => API.request('/auth/logout', { method: 'POST' }),
    me: () => API.request('/auth/me', { method: 'GET' })
  },

  // Dashboard API
  dashboard: {
    get: () => API.request('/dashboard', { method: 'GET' })
  },

  // Public Stats API
  stats: {
    getPublic: () => API.request('/stats/public', { method: 'GET' })
  },

  // Listings API
  listings: {
    getAll: (params = {}) => {
      const query = new URLSearchParams();
      if (params.category && params.category !== 'ALL') query.append('category', params.category);
      if (params.search) query.append('search', params.search);
      return API.request(`/listings?${query.toString()}`, { method: 'GET' });
    },
    getMy: () => API.request('/listings/my', { method: 'GET' }),
    getById: (id) => API.request(`/listings/${id}`, { method: 'GET' }),
    create: (data) => API.request('/listings', { method: 'POST', body: data }),
    update: (id, data) => API.request(`/listings/${id}`, { method: 'PUT', body: data }),
    cancel: (id) => API.request(`/listings/${id}`, { method: 'DELETE' })
  },

  // AI Surplus Predictor API (FR-11)
  predictor: {
    getForecast: () => API.request('/predictor/forecast', { method: 'GET' })
  },

  // Claims API (FR-5)
  claims: {
    claim: (listingId, expectedVersion) => API.request('/claims', {
      method: 'POST',
      body: { listingId, expectedVersion }
    }),
    getMy: () => API.request('/claims/my', { method: 'GET' }),
    getById: (id) => API.request(`/claims/${id}`, { method: 'GET' })
  },

  // Deliveries API (FR-6)
  deliveries: {
    getAvailable: () => API.request('/deliveries/available', { method: 'GET' }),
    getMy: () => API.request('/deliveries/my', { method: 'GET' }),
    accept: (claimId) => API.request(`/deliveries/accept/${claimId}`, { method: 'POST' }),
    pickup: (deliveryId) => API.request(`/deliveries/${deliveryId}/pickup`, { method: 'POST' }),
    deliver: (deliveryId) => API.request(`/deliveries/${deliveryId}/deliver`, { method: 'POST' })
  },

  // Notifications API (FR-7)
  notifications: {
    get: () => API.request('/notifications', { method: 'GET' }),
    markRead: (id) => API.request(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => API.request('/notifications/read-all', { method: 'PUT' })
  },

  // Admin API (FR-9, FR-10)
  admin: {
    getUsers: (filters = {}) => {
      const query = new URLSearchParams();
      if (filters.role) query.append('role', filters.role);
      if (filters.search) query.append('search', filters.search);
      if (filters.enabled !== undefined) query.append('enabled', filters.enabled);
      return API.request(`/admin/users?${query.toString()}`, { method: 'GET' });
    },
    setUserStatus: (userId, enabled) => API.request(`/admin/users/${userId}/status`, {
      method: 'PUT',
      body: { enabled }
    }),
    getNgos: (status = null) => {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      return API.request(`/admin/ngos${query}`, { method: 'GET' });
    },
    reviewNgo: (ngoProfileId, status) => API.request(`/admin/ngos/${ngoProfileId}/verify`, {
      method: 'PUT',
      body: { status }
    }),
    getAnalytics: () => API.request('/admin/analytics', { method: 'GET' })
  }
};

window.API = API;
