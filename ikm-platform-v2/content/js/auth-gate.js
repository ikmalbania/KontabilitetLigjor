// ===== Course-page auth display + copy deterrents =====
// Access to this page is already enforced server-side by the
// netlify/edge-functions/auth-gate.js edge function — if you're seeing
// this page at all, you're already authenticated. This script only
// handles the display bits (showing the email, watermark, logout) using
// the non-httpOnly ikm_email cookie, which carries no authority of its
// own — it's read-only display info, not what grants access.

(function () {
  function readCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function paintWatermark(email) {
    const wm = document.getElementById('watermark');
    if (!wm) return;
    wm.innerHTML = '';
    const label = email || 'IKM';
    for (let i = 0; i < 24; i++) {
      const span = document.createElement('span');
      span.textContent = label;
      wm.appendChild(span);
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    const email = readCookie('ikm_email');
    document.body.classList.add('authenticated');
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = email || '';
    paintWatermark(email);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        try {
          await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
        } catch (e) {
          // Even if the request fails, still send them to the landing
          // page — the session cookie is short-lived and httpOnly so
          // there's nothing else to clean up client-side.
        }
        window.location.href = '/';
      });
    }

    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', function () {
        openChangePasswordDialog();
      });
    }
  });

  function openChangePasswordDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'pw-overlay';
    overlay.innerHTML =
      '<div class="pw-dialog">' +
      '<h3>Ndrysho fjalëkalimin</h3>' +
      '<input type="password" id="pw-current" placeholder="Fjalëkalimi aktual" autocomplete="current-password">' +
      '<input type="password" id="pw-new" placeholder="Fjalëkalimi i ri (min. 8 karaktere)" autocomplete="new-password">' +
      '<div id="pw-msg" class="pw-msg" style="display:none"></div>' +
      '<div class="pw-actions">' +
      '<button type="button" class="btn-ghost" id="pw-cancel">Anulo</button>' +
      '<button type="button" class="btn-primary" id="pw-submit" style="width:auto;padding:8px 20px">Ruaj</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    document.getElementById('pw-cancel').addEventListener('click', function () {
      overlay.remove();
    });

    document.getElementById('pw-submit').addEventListener('click', async function () {
      const current = document.getElementById('pw-current').value;
      const next = document.getElementById('pw-new').value;
      const msg = document.getElementById('pw-msg');
      msg.style.display = 'none';
      try {
        const res = await fetch('/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ currentPassword: current, newPassword: next }),
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.error || 'Gabim.');
        msg.textContent = 'Fjalëkalimi u ndryshua.';
        msg.className = 'pw-msg pw-msg-ok';
        msg.style.display = 'block';
        setTimeout(function () { overlay.remove(); }, 1200);
      } catch (err) {
        msg.textContent = err.message;
        msg.className = 'pw-msg pw-msg-error';
        msg.style.display = 'block';
      }
    });
  }

  // ---- Soft deterrents (do not rely on these for real protection) ----
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });
  document.addEventListener('keydown', function (e) {
    const blocked =
      (e.ctrlKey || e.metaKey) && ['c', 'p', 's', 'u'].includes(e.key.toLowerCase());
    if (blocked) e.preventDefault();
  });
})();
