document.addEventListener('DOMContentLoaded', () => {
  const state = { orderPage: 1, customerPage: 1, orderSearch: '', customerSearch: '' };
  const loading = document.getElementById('adminLoading');
  const shell = document.getElementById('adminShell');
  const message = document.getElementById('adminMessage');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
  const date = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '-';
  const money = (value, currency = 'INR') => `${currency} ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const showError = (error) => {
    if (error.status === 401) window.location.replace('login.html');
    else if (error.status === 403) { shell.hidden = true; loading.hidden = false; loading.innerHTML = '<span class="loading-error">You do not have permission to access the admin console.</span>'; }
    else { message.textContent = error.message || 'Could not load admin data.'; message.className = 'dashboard-message error'; }
  };
  const api = (path, options) => RotimaticApi.request(path, options);

  function renderStats(stats) {
    const cards = [['Customers', stats.totalCustomers], ['Orders', stats.totalOrders], ['Pending orders', stats.pendingOrders], ['Confirmed orders', stats.confirmedOrders], ['Revenue', money(stats.totalRevenue)], ['Pending payments', stats.pendingPayments]];
    document.getElementById('statGrid').innerHTML = cards.map(([label, value]) => `<article class="admin-stat-card dashboard-card"><span class="card-eyebrow">${label}</span><strong>${escapeHtml(value)}</strong></article>`).join('');
  }
  function renderPagination(target, result, onPage) {
    const pagination = result.pagination;
    target.innerHTML = `<button class="btn btn-secondary btn-small" ${pagination.page <= 1 ? 'disabled' : ''} data-page="${pagination.page - 1}">Previous</button><span>Page ${pagination.page} of ${Math.max(pagination.totalPages, 1)}</span><button class="btn btn-secondary btn-small" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} data-page="${pagination.page + 1}">Next</button>`;
    target.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => onPage(Number(button.dataset.page))));
  }
  async function loadStats() { const response = await api('/admin/stats'); renderStats(response.data.stats); }
  async function loadOrders() {
    const response = await api(`/admin/orders?page=${state.orderPage}&limit=15&search=${encodeURIComponent(state.orderSearch)}`);
    document.getElementById('ordersBody').innerHTML = response.data.orders.map((order) => `<tr tabindex="0" data-order-id="${order.id}"><td><strong>${escapeHtml(order.orderNumber)}</strong></td><td>${escapeHtml(`${order.firstName} ${order.lastName}`)}<small>${escapeHtml(order.email)}</small></td><td>${escapeHtml(order.products)}<small>Qty ${order.quantity}</small></td><td>${money(order.totalAmount, order.currency)}</td><td><span class="admin-status status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span></td><td>${escapeHtml(order.paymentStatus)}</td><td>${date(order.createdAt)}</td></tr>`).join('') || '<tr><td colspan="7" class="admin-empty">No orders found.</td></tr>';
    renderPagination(document.getElementById('ordersPagination'), response.data, (page) => { state.orderPage = page; loadOrders(); });
    document.querySelectorAll('#ordersBody tr[data-order-id]').forEach((row) => row.addEventListener('click', () => showOrder(row.dataset.orderId)));
  }
  async function loadCustomers() {
    const response = await api(`/admin/customers?page=${state.customerPage}&limit=15&search=${encodeURIComponent(state.customerSearch)}`);
    document.getElementById('customersBody').innerHTML = response.data.customers.map((customer) => `<tr tabindex="0" data-customer-id="${customer.id}"><td><strong>${escapeHtml(`${customer.firstName} ${customer.lastName}`)}</strong><small>${escapeHtml(customer.phone || 'No phone')}</small></td><td>${escapeHtml(customer.email)}</td><td>${customer.orderCount}</td><td>${money(customer.confirmedSpend)}</td><td>${date(customer.createdAt)}</td></tr>`).join('') || '<tr><td colspan="5" class="admin-empty">No customers found.</td></tr>';
    renderPagination(document.getElementById('customersPagination'), response.data, (page) => { state.customerPage = page; loadCustomers(); });
    document.querySelectorAll('#customersBody tr[data-customer-id]').forEach((row) => row.addEventListener('click', () => showCustomer(row.dataset.customerId)));
  }
  function openModal(title, body) { document.getElementById('adminModalTitle').textContent = title; document.getElementById('adminModalBody').innerHTML = body; document.getElementById('adminModal').classList.add('active'); document.getElementById('adminModal').setAttribute('aria-hidden', 'false'); }
  function renderPaymentCard(payment, currency) {
    if (payment.provider === 'razorpay') {
      const statusLabel = { captured: 'Captured', authorized: 'Authorized', pending: 'Pending', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Partially refunded' }[payment.status] || payment.status;
      return `<div class="payment-card"><div class="cost-line"><span>Payment Method</span><strong>Razorpay</strong></div><div class="cost-line"><span>Amount</span><strong>${money(payment.amount, currency)}</strong></div><div class="cost-line"><span>Payment Status</span><strong>${escapeHtml(statusLabel)}</strong></div>${payment.provider_payment_id ? `<div class="cost-line"><span>Razorpay Payment ID</span><strong>${escapeHtml(payment.provider_payment_id)}</strong></div>` : ''}</div>`;
    }
    // manual_upi
    const statusLabel = { pending: 'Pending Verification', captured: 'Confirmed', rejected: 'Rejected' }[payment.status] || payment.status;
    const actions = payment.status === 'pending'
      ? `<div class="payment-card-actions"><button class="btn btn-primary btn-small" data-confirm-payment="${payment.id}">Confirm Payment</button><button class="btn btn-secondary btn-small" data-reject-payment="${payment.id}">Reject Payment</button></div>`
      : payment.status === 'rejected' && payment.rejection_reason
        ? `<div class="cost-line"><span>Rejection Reason</span><strong>${escapeHtml(payment.rejection_reason)}</strong></div>`
        : '';
    return `<div class="payment-card"><div class="cost-line"><span>Payment Method</span><strong>UPI / QR</strong></div><div class="cost-line"><span>Amount</span><strong>${money(payment.amount, currency)}</strong></div><div class="cost-line"><span>UPI Reference</span><strong>${escapeHtml(payment.reference_id || '—')}</strong></div><div class="cost-line"><span>Status</span><strong>${escapeHtml(statusLabel)}</strong></div><div class="cost-line"><span>Submitted</span><strong>${date(payment.created_at)}</strong></div>${actions}</div>`;
  }
  async function showOrder(id) {
    try {
      const response = await api(`/admin/orders/${id}`);
      const { order, items, payments } = response.data;
      openModal(order.order_number, `<div class="admin-detail-grid"><div><span>Customer</span><strong>${escapeHtml(`${order.first_name} ${order.last_name}`)}</strong><small>${escapeHtml(order.email)} · ${escapeHtml(order.phone || 'No phone')}</small></div><div><span>Total</span><strong>${money(order.total_amount, order.currency)}</strong></div><div><span>Shipping</span><strong>${escapeHtml(order.shipping_full_name)}</strong><small>${escapeHtml([order.shipping_address_line1, order.shipping_address_line2, order.shipping_city, order.shipping_state, order.shipping_postal_code, order.shipping_country].filter(Boolean).join(', '))}</small></div><div><span>Status</span><select id="orderStatusSelect"><option ${order.status === 'pending' ? 'selected' : ''}>pending</option><option ${order.status === 'processing' ? 'selected' : ''}>processing</option><option ${order.status === 'shipped' ? 'selected' : ''}>shipped</option><option ${order.status === 'delivered' ? 'selected' : ''}>delivered</option><option ${order.status === 'cancelled' ? 'selected' : ''}>cancelled</option></select><button class="btn btn-primary btn-small" id="saveOrderStatus">Update status</button></div></div><h3>Items</h3><p>${items.map((item) => `${escapeHtml(item.product_name)} / ${escapeHtml(item.variant)} · Qty ${item.quantity} · ${money(item.total_price, order.currency)}`).join('<br>')}</p><h3>Payments</h3>${payments.length ? payments.map((payment) => renderPaymentCard(payment, order.currency)).join('') : '<p>No payment records.</p>'}`);
      document.getElementById('saveOrderStatus').addEventListener('click', async () => { const status = document.getElementById('orderStatusSelect').value; await api(`/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); document.getElementById('adminModal').classList.remove('active'); loadOrders(); });
      document.querySelectorAll('[data-confirm-payment]').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        try { await api(`/admin/payments/${button.dataset.confirmPayment}/confirm`, { method: 'POST' }); document.getElementById('adminModal').classList.remove('active'); loadOrders(); } catch (error) { showError(error); button.disabled = false; }
      }));
      document.querySelectorAll('[data-reject-payment]').forEach((button) => button.addEventListener('click', async () => {
        const reason = window.prompt('Rejection reason (optional):', '') || undefined;
        button.disabled = true;
        try { await api(`/admin/payments/${button.dataset.rejectPayment}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); document.getElementById('adminModal').classList.remove('active'); loadOrders(); } catch (error) { showError(error); button.disabled = false; }
      }));
    } catch (error) { showError(error); }
  }
  async function loadPaymentSettings() {
    try {
      const response = await api('/admin/payment-settings');
      const settings = response.data.paymentSettings;
      document.getElementById('razorpayConfiguredBadge').textContent = settings.razorpayConfigured ? 'Configured' : 'Not configured';
      document.getElementById('manualUpiEnabledBadge').textContent = settings.manualUpiEnabled ? 'Enabled' : 'Not configured';
      document.getElementById('upiIdInput').value = settings.upiId || '';
      document.getElementById('qrImagePathInput').value = settings.qrImagePath || '';
      const previewWrap = document.getElementById('qrImagePreviewWrap');
      const preview = document.getElementById('qrImagePreview');
      if (settings.qrImagePath) { preview.src = settings.qrImagePath; previewWrap.hidden = false; } else { previewWrap.hidden = true; }
    } catch (error) { showError(error); }
  }
  async function showCustomer(id) { try { const response = await api(`/admin/customers/${id}`); const { customer, orders } = response.data; openModal(`${customer.first_name} ${customer.last_name}`, `<div class="admin-detail-grid"><div><span>Email</span><strong>${escapeHtml(customer.email)}</strong></div><div><span>Phone</span><strong>${escapeHtml(customer.phone || 'No phone')}</strong></div><div><span>Joined</span><strong>${date(customer.created_at)}</strong></div><div><span>Orders</span><strong>${orders.length}</strong></div></div><h3>Orders</h3><p>${orders.length ? orders.map((order) => `${escapeHtml(order.order_number)} · ${escapeHtml(order.status)} · ${money(order.total_amount, order.currency)}`).join('<br>') : 'No orders.'}</p>`); } catch (error) { showError(error); } }
  function setSection(section) { document.querySelectorAll('.admin-nav-link').forEach((button) => button.classList.toggle('active', button.dataset.section === section)); document.querySelectorAll('.admin-section').forEach((panel) => { panel.hidden = panel.dataset.sectionPanel !== section; panel.classList.toggle('active', panel.dataset.sectionPanel === section); }); if (section === 'orders') loadOrders(); if (section === 'customers') loadCustomers(); if (section === 'payments') loadPaymentSettings(); }
  document.querySelectorAll('.admin-nav-link').forEach((button) => button.addEventListener('click', () => setSection(button.dataset.section)));
  document.getElementById('orderSearchButton').addEventListener('click', () => { state.orderSearch = document.getElementById('orderSearch').value.trim(); state.orderPage = 1; loadOrders(); });
  document.getElementById('customerSearchButton').addEventListener('click', () => { state.customerSearch = document.getElementById('customerSearch').value.trim(); state.customerPage = 1; loadCustomers(); });
  document.getElementById('paymentSettingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const messageEl = document.getElementById('paymentSettingsMessage');
    const body = {};
    const upiId = document.getElementById('upiIdInput').value.trim();
    const qrImagePath = document.getElementById('qrImagePathInput').value.trim();
    if (upiId) body.upiId = upiId;
    if (qrImagePath) body.qrImagePath = qrImagePath;
    if (!Object.keys(body).length) { messageEl.textContent = 'Enter a UPI ID or QR image path to save.'; messageEl.className = 'dashboard-message error'; return; }
    try {
      await api('/admin/payment-settings', { method: 'PATCH', body: JSON.stringify(body) });
      messageEl.textContent = 'Payment settings saved.'; messageEl.className = 'dashboard-message';
      loadPaymentSettings();
    } catch (error) { messageEl.textContent = error.message || 'Could not save payment settings.'; messageEl.className = 'dashboard-message error'; }
  });
  document.getElementById('closeAdminModal').addEventListener('click', () => document.getElementById('adminModal').classList.remove('active'));
  document.getElementById('adminLogout').addEventListener('click', async () => { await RotimaticApi.logout(); window.location.replace('index.html'); });
  (async () => { try { await api('/admin/stats'); await loadStats(); shell.hidden = false; loading.hidden = true; } catch (error) { showError(error); } })();
});
