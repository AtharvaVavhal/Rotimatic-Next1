document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const message = document.getElementById('loginMessage');
  const submit = document.getElementById('loginSubmit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    message.className = 'form-message';
    message.textContent = '';
    if (!email || !password) {
      message.className = 'form-message error';
      message.textContent = 'Enter your email and password to continue.';
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Logging in...';
    try {
      await RotimaticApi.login({ email, password });
      window.location.href = 'dashboard.html';
    } catch (error) {
      message.className = 'form-message error';
      message.textContent = error.status === 401 ? 'The email or password is incorrect.' : (error.status >= 500 ? 'We could not reach your account. Please try again.' : error.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Log in';
    }
  });
});
