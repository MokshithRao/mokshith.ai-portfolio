/* ============================================================
   Admin Authentication
   Keeps editing controls hidden unless the server session is valid.
   ============================================================ */

(function () {
  'use strict';

  const loginTrigger = document.getElementById('admin-login-trigger');
  const logoutButton = document.getElementById('admin-logout-button');
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('admin-login-error');
  const loginSubmit = document.getElementById('admin-login-submit');
  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  const resetRequest = document.getElementById('admin-password-reset-request');
  const resetRequestMessage = document.getElementById('admin-password-reset-request-message');
  const resetRequestSubmit = document.getElementById('admin-password-reset-request-submit');
  const resetConfirm = document.getElementById('admin-password-reset-confirm');
  const resetConfirmMessage = document.getElementById('admin-password-reset-confirm-message');
  const resetConfirmSubmit = document.getElementById('admin-password-reset-confirm-submit');
  const loginDialog = document.getElementById('admin-login-dialog');
  let resetToken = new URLSearchParams(window.location.search).get('admin-reset') || '';
  let expiryTimer = null;
  let sessionCheckRevision = 0;

  function showLoginForm() {
    loginForm.hidden = false;
    resetRequest.hidden = true;
    resetConfirm.hidden = true;
    document.getElementById('admin-login-title').textContent = 'Admin Login';
    loginDialog.setAttribute('aria-labelledby', 'admin-login-title');
  }

  function showResetRequestForm() {
    loginForm.hidden = true;
    resetRequest.hidden = false;
    resetConfirm.hidden = true;
    loginDialog.setAttribute('aria-labelledby', 'admin-reset-request-title');
  }

  function showResetConfirmForm() {
    loginForm.hidden = true;
    resetRequest.hidden = true;
    resetConfirm.hidden = false;
    loginDialog.setAttribute('aria-labelledby', 'admin-reset-confirm-title');
    window.openModal('admin-login-modal');
    document.getElementById('admin-new-password').focus();
  }

  function setAuthenticated(authenticated, expiresAt) {
    document.body.classList.toggle('admin-authenticated', authenticated);
    loginTrigger.hidden = authenticated;
    logoutButton.hidden = !authenticated;
    if (expiryTimer) clearTimeout(expiryTimer);

    if (authenticated && expiresAt) {
      expiryTimer = setTimeout(() => {
        sessionCheckRevision += 1;
        setAuthenticated(false);
      }, Math.max(0, expiresAt - Date.now()));
    }
  }

  async function checkSession() {
    const revision = ++sessionCheckRevision;
    try {
      const response = await fetch('/api/admin/session', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to check admin session.');
      const result = await response.json();
      if (revision !== sessionCheckRevision) return;
      setAuthenticated(Boolean(result.authenticated), result.expiresAt);
    } catch (error) {
      if (revision !== sessionCheckRevision) return;
      setAuthenticated(false);
      console.error('Admin session check failed:', error);
    }
  }

  loginTrigger.addEventListener('click', () => {
    showLoginForm();
    loginError.textContent = '';
    loginError.classList.remove('visible');
    window.openModal('admin-login-modal');
    usernameInput.focus();
  });

  document.getElementById('admin-login-close').addEventListener('click', () => {
    window.closeModal('admin-login-modal');
    loginForm.reset();
    resetConfirm.reset();
    showLoginForm();
  });

  document.getElementById('admin-forgot-password').addEventListener('click', () => {
    resetRequestMessage.textContent = '';
    resetRequestMessage.classList.remove('visible');
    showResetRequestForm();
  });

  document.getElementById('admin-password-reset-back').addEventListener('click', showLoginForm);

  resetRequestSubmit.addEventListener('click', async () => {
    resetRequestMessage.textContent = '';
    resetRequestMessage.classList.remove('visible');
    resetRequestSubmit.disabled = true;
    resetRequestSubmit.textContent = 'Sending...';
    try {
      const response = await fetch('/api/admin/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to request a reset link.');
      resetRequestMessage.textContent = result.message;
      resetRequestMessage.classList.add('visible');
    } catch (error) {
      resetRequestMessage.textContent = error.message || 'Unable to request a reset link.';
      resetRequestMessage.classList.add('visible');
    } finally {
      resetRequestSubmit.disabled = false;
      resetRequestSubmit.textContent = 'Send reset link';
    }
  });

  resetConfirm.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetConfirmMessage.textContent = '';
    resetConfirmMessage.classList.remove('visible');
    resetConfirmSubmit.disabled = true;
    resetConfirmSubmit.textContent = 'Updating...';
    try {
      const response = await fetch('/api/admin/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          password: document.getElementById('admin-new-password').value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update the password.');

      resetToken = '';
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('admin-reset');
      window.history.replaceState({}, '', cleanUrl);
      resetConfirmMessage.textContent = result.message;
      resetConfirmMessage.classList.add('visible');
      resetConfirm.reset();
      setTimeout(() => {
        window.closeModal('admin-login-modal');
        showLoginForm();
        loginError.textContent = '';
        loginError.classList.remove('visible');
        usernameInput.focus();
      }, 1800);
    } catch (error) {
      resetConfirmMessage.textContent = error.message || 'Unable to update the password.';
      resetConfirmMessage.classList.add('visible');
    } finally {
      resetConfirmSubmit.disabled = false;
      resetConfirmSubmit.textContent = 'Update password';
    }
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = '';
    loginError.classList.remove('visible');
    loginSubmit.disabled = true;
    loginSubmit.textContent = 'Signing In...';

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.value,
          password: passwordInput.value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.');

      sessionCheckRevision += 1;
      setAuthenticated(true, result.expiresAt);
      window.closeModal('admin-login-modal');
      loginForm.reset();
    } catch (error) {
      loginError.textContent = error.message || 'Unable to sign in.';
      loginError.classList.add('visible');
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = 'Sign In';
    }
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to log out. Please try again.');
      sessionCheckRevision += 1;
      setAuthenticated(false);
    } catch (error) {
      console.error('Admin logout failed:', error);
      window.alert(error.message || 'Unable to log out. Please try again.');
    } finally {
      logoutButton.disabled = false;
    }
  });

  window.addEventListener('focus', checkSession);
  if (resetToken) showResetConfirmForm();
  checkSession();
})();
