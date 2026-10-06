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
  let expiryTimer = null;
  let sessionCheckRevision = 0;

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
    loginError.textContent = '';
    loginError.classList.remove('visible');
    window.openModal('admin-login-modal');
    usernameInput.focus();
  });

  document.getElementById('admin-login-close').addEventListener('click', () => {
    window.closeModal('admin-login-modal');
    loginForm.reset();
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
  checkSession();
})();
