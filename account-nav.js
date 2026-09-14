document.addEventListener('DOMContentLoaded', async () => {
  const accountLink = document.getElementById('accountNavLink');
  if (!accountLink || !window.RotimaticApi) return;

  const iconSvg = `<svg class="nav-account-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  try {
    const response = await RotimaticApi.me();
    if (response && response.data && response.data.authenticated) {
      accountLink.innerHTML = `${iconSvg}<span>Account</span>`;
      accountLink.href = 'dashboard.html';
      accountLink.title = 'Open My Account';
      accountLink.classList.add('is-auth');
    }
  } catch (error) {
    accountLink.innerHTML = `${iconSvg}<span>Login</span>`;
    accountLink.href = 'login.html';
    accountLink.title = 'Account Login';
    accountLink.classList.remove('is-auth');
  }
});
