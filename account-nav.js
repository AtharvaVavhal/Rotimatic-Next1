document.addEventListener('DOMContentLoaded', async () => {
  const accountLink = document.getElementById('accountNavLink');
  if (!accountLink || !window.RotimaticApi) return;

  try {
    const response = await RotimaticApi.me();
    if (response && response.data && response.data.authenticated) {
      accountLink.textContent = 'My Account';
      accountLink.href = 'dashboard.html';
    }
  } catch (error) {
    accountLink.textContent = 'Login';
    accountLink.href = 'login.html';
  }
});
