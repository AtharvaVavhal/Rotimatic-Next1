document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signupForm');
  const message = document.getElementById('signupMessage');
  const submit = document.getElementById('signupSubmit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      password: form.password.value
    };
    message.className = 'form-message';
    message.textContent = '';
    if (!body.firstName || !body.lastName || !body.email || !body.password) {
      message.className = 'form-message error';
      message.textContent = 'Complete the required fields to create your account.';
      return;
    }
    if (body.password.length < 8) {
      message.className = 'form-message error';
      message.textContent = 'Your password must be at least 8 characters.';
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Creating account...';
    try {
      await RotimaticApi.signup(body);
      window.location.href = 'dashboard.html';
    } catch (error) {
      message.className = 'form-message error';
      message.textContent = error.status >= 500 ? 'We could not create your account right now.' : error.message;
    } finally {
      submit.disabled = false;
      submit.textContent = 'Create account';
    }
  });
});
