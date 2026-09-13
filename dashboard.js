document.addEventListener('DOMContentLoaded', () => {
  const state = { user: null, addresses: [], editingAddressId: null };
  const loading = document.getElementById('dashboardLoading');
  const shell = document.getElementById('dashboardShell');
  const dashboardMessage = document.getElementById('dashboardMessage');
  const addressMessage = document.getElementById('addressMessage');
  const addressFormMessage = document.getElementById('addressFormMessage');
  const addressModal = document.getElementById('addressModal');
  const addressForm = document.getElementById('addressForm');
  const profileForm = document.getElementById('profileForm');

  const redirectToLogin = () => { window.location.replace('login.html'); };
  const showMessage = (element, text, type = 'success') => {
    element.textContent = text;
    element.className = `${element.id === 'dashboardMessage' ? 'dashboard-message' : element.id === 'addressMessage' ? 'inline-message' : 'form-message'} ${type}`;
    if (text) window.setTimeout(() => { element.textContent = ''; element.className = element.id === 'dashboardMessage' ? 'dashboard-message' : element.id === 'addressMessage' ? 'inline-message' : 'form-message'; }, 5000);
  };
  const handleError = (error, element) => {
    if (error.status === 401) { redirectToLogin(); return; }
    const message = error.status === 404 ? 'That item could not be found.' : error.status === 409 ? error.message : error.status >= 500 ? 'Something went wrong on our side. Please try again.' : error.message;
    showMessage(element, message, 'error');
  };
  const initials = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'R';
  const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(value)) : '-';
  const formatAddress = (address) => [address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(', ');

  function renderUser() {
    const user = state.user;
    const name = `${user.firstName} ${user.lastName}`.trim();
    const userInitials = initials(user);
    document.getElementById('dashboardWelcome').textContent = `Welcome, ${user.firstName}.`;
    document.getElementById('sidebarName').textContent = name;
    document.getElementById('sidebarEmail').textContent = user.email;
    document.getElementById('userInitials').textContent = userInitials;
    document.getElementById('overviewInitials').textContent = userInitials;
    document.getElementById('overviewName').textContent = name;
    document.getElementById('overviewEmail').textContent = user.email;
    document.getElementById('overviewPhone').textContent = user.phone || 'Phone not added';
    document.getElementById('overviewCreated').textContent = formatDate(user.createdAt);
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileCreated').textContent = formatDate(user.createdAt);
    document.getElementById('profileFirstName').value = user.firstName || '';
    document.getElementById('profileLastName').value = user.lastName || '';
    document.getElementById('profilePhone').value = user.phone || '';
  }

  function renderOverviewAddresses() {
    const summary = document.getElementById('overviewAddressSummary');
    const address = state.addresses.find((item) => item.isDefault) || state.addresses[0];
    if (!address) {
      summary.innerHTML = '<span class="mini-icon">+</span><p>No saved addresses yet.</p>';
      return;
    }
    summary.innerHTML = `<span class="mini-icon">⌖</span><div><strong>${escapeHtml(address.fullName)}</strong><p>${escapeHtml(formatAddress(address))}</p></div>`;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
  }

  function renderAddresses() {
    const list = document.getElementById('addressList');
    const empty = document.getElementById('addressEmpty');
    const loadingState = document.getElementById('addressLoading');
    loadingState.hidden = true;
    list.innerHTML = '';
    empty.hidden = state.addresses.length !== 0;
    state.addresses.forEach((address) => {
      const card = document.createElement('article');
      card.className = 'address-card dashboard-card';
      card.innerHTML = `<div class="address-card-heading"><div><span class="card-eyebrow">${address.isDefault ? 'Primary delivery' : 'Saved address'}</span><h3>${escapeHtml(address.fullName)}</h3></div>${address.isDefault ? '<span class="default-badge">Default</span>' : ''}</div><div class="address-card-details"><p>${escapeHtml(address.phone)}</p><p>${escapeHtml(address.addressLine1)}</p>${address.addressLine2 ? `<p>${escapeHtml(address.addressLine2)}</p>` : ''}<p>${escapeHtml([address.city, address.state, address.postalCode].filter(Boolean).join(', '))}</p><p>${escapeHtml(address.country)}</p></div><div class="address-card-actions"><button class="text-action" type="button" data-edit-address="${address.id}">Edit</button>${!address.isDefault ? `<button class="text-action" type="button" data-default-address="${address.id}">Set as default</button>` : ''}<button class="text-action danger-action" type="button" data-delete-address="${address.id}">Delete</button></div>`;
      list.appendChild(card);
    });
    renderOverviewAddresses();
  }

  async function loadAddresses() {
    document.getElementById('addressLoading').hidden = false;
    document.getElementById('addressList').innerHTML = '';
    document.getElementById('addressEmpty').hidden = true;
    try {
      const response = await RotimaticApi.addresses();
      state.addresses = response.data.addresses || [];
      renderAddresses();
    } catch (error) { handleError(error, addressMessage); }
  }

  function setView(view) {
    document.querySelectorAll('.dashboard-nav-link').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    document.querySelectorAll('.dashboard-view').forEach((panel) => { const active = panel.dataset.panel === view; panel.classList.toggle('active', active); panel.hidden = !active; });
    if (view === 'addresses' && !document.getElementById('addressList').children.length && !state.addresses.length) loadAddresses();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleProfileEdit(editing) {
    profileForm.hidden = !editing;
    document.getElementById('profileEditButton').hidden = editing;
  }

  function openAddressForm(address) {
    state.editingAddressId = address ? address.id : null;
    document.getElementById('addressModalTitle').textContent = address ? 'Edit address' : 'Add address';
    addressFormMessage.textContent = '';
    addressFormMessage.className = 'form-message';
    const fields = ['fullName', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country'];
    fields.forEach((field) => { addressForm[field].value = address ? address[field] || '' : field === 'country' ? 'India' : ''; });
    addressForm.isDefault.checked = Boolean(address && address.isDefault);
    addressModal.classList.add('active');
    addressModal.setAttribute('aria-hidden', 'false');
    addressForm.fullName.focus();
  }

  function closeAddressForm() { addressModal.classList.remove('active'); addressModal.setAttribute('aria-hidden', 'true'); }

  document.querySelectorAll('.dashboard-nav-link').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-view-target]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.viewTarget)));
  document.getElementById('profileEditButton').addEventListener('click', () => toggleProfileEdit(true));
  document.getElementById('profileCancelButton').addEventListener('click', () => { toggleProfileEdit(false); renderUser(); });
  document.getElementById('addAddressButton').addEventListener('click', () => openAddressForm());
  document.querySelector('[data-open-address-form]').addEventListener('click', () => { setView('addresses'); openAddressForm(); });
  document.getElementById('closeAddressModal').addEventListener('click', closeAddressForm);
  document.getElementById('cancelAddressButton').addEventListener('click', closeAddressForm);
  addressModal.addEventListener('click', (event) => { if (event.target === addressModal) closeAddressForm(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && addressModal.classList.contains('active')) closeAddressForm(); });

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('profileSaveButton');
    const body = { firstName: profileForm.firstName.value.trim(), lastName: profileForm.lastName.value.trim(), phone: profileForm.phone.value.trim() };
    if (!body.firstName || !body.lastName || !body.phone) { showMessage(dashboardMessage, 'First name, last name, and phone cannot be empty.', 'error'); return; }
    button.disabled = true; button.textContent = 'Saving...';
    try {
      const response = await RotimaticApi.updateProfile(body);
      state.user = response.data.user; renderUser(); toggleProfileEdit(false); showMessage(dashboardMessage, 'Profile updated successfully.');
    } catch (error) { handleError(error, dashboardMessage); } finally { button.disabled = false; button.textContent = 'Save changes'; }
  });

  addressForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('saveAddressButton');
    const body = { fullName: addressForm.fullName.value.trim(), phone: addressForm.phone.value.trim(), addressLine1: addressForm.addressLine1.value.trim(), addressLine2: addressForm.addressLine2.value.trim(), city: addressForm.city.value.trim(), state: addressForm.state.value.trim(), postalCode: addressForm.postalCode.value.trim(), country: addressForm.country.value.trim(), isDefault: addressForm.isDefault.checked };
    const required = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'postalCode', 'country'];
    if (required.some((field) => !body[field])) { showMessage(addressFormMessage, 'Complete all required address fields.', 'error'); return; }
    button.disabled = true; button.textContent = 'Saving...';
    try {
      if (state.editingAddressId) await RotimaticApi.updateAddress(state.editingAddressId, body); else await RotimaticApi.createAddress(body);
      closeAddressForm(); await loadAddresses(); showMessage(addressMessage, 'Address saved successfully.');
    } catch (error) { handleError(error, addressFormMessage); } finally { button.disabled = false; button.textContent = 'Save address'; }
  });

  document.getElementById('addressList').addEventListener('click', async (event) => {
    const editId = event.target.dataset.editAddress;
    const defaultId = event.target.dataset.defaultAddress;
    const deleteId = event.target.dataset.deleteAddress;
    if (editId) openAddressForm(state.addresses.find((address) => address.id === editId));
    if (defaultId) {
      event.target.disabled = true;
      try { await RotimaticApi.updateAddress(defaultId, { isDefault: true }); await loadAddresses(); showMessage(addressMessage, 'Default address updated.'); } catch (error) { handleError(error, addressMessage); } finally { event.target.disabled = false; }
    }
    if (deleteId && window.confirm('Delete this saved address?')) {
      event.target.disabled = true;
      try { await RotimaticApi.deleteAddress(deleteId); await loadAddresses(); showMessage(addressMessage, 'Address deleted.'); } catch (error) { handleError(error, addressMessage); } finally { event.target.disabled = false; }
    }
  });

  document.getElementById('logoutButton').addEventListener('click', async (event) => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'Logging out...';
    try { await RotimaticApi.logout(); } finally { window.location.replace('index.html'); }
  });

  (async function initialize() {
    try {
      const response = await RotimaticApi.me();
      if (!response || !response.data || !response.data.authenticated) { redirectToLogin(); return; }
      state.user = response.data.user; renderUser(); await loadAddresses();
      shell.hidden = false; loading.hidden = true;
    } catch (error) {
      if (error.status === 401) { redirectToLogin(); return; }
      loading.innerHTML = '<span class="loading-error">We could not load your account. Please refresh and try again.</span>';
    }
  }());
});
