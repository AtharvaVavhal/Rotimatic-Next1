(function attachApiClient(global) {
  const configuredBase = global.ROTImaticConfig && global.ROTImaticConfig.apiBase;
  const isLocalStaticPreview = ['localhost', '127.0.0.1'].includes(global.location.hostname) && global.location.port !== '5001';
  const localApiHost = global.location.hostname || 'localhost';
  const apiBase = configuredBase || (global.location.protocol === 'file:' || isLocalStaticPreview ? `http://${localApiHost}:5001/api` : '/api');

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      ...options
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (!response.ok) {
      const apiError = new Error(payload && payload.message ? payload.message : 'Something went wrong. Please try again.');
      apiError.status = response.status;
      throw apiError;
    }
    return payload;
  }

  global.RotimaticApi = {
    request,
    me: () => request('/auth/me'),
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    profile: () => request('/users/me'),
    updateProfile: (body) => request('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
    addresses: () => request('/addresses'),
    createAddress: (body) => request('/addresses', { method: 'POST', body: JSON.stringify(body) }),
    updateAddress: (id, body) => request(`/addresses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteAddress: (id) => request(`/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    createOrder: (body) => request('/orders', { method: 'POST', body: JSON.stringify(body) }),
    createPaymentOrder: (body) => request('/payments/create-order', { method: 'POST', body: JSON.stringify(body) }),
    verifyPayment: (body) => request('/payments/verify', { method: 'POST', body: JSON.stringify(body) })
  };
})(window);
