;(function () {
  var apiBaseUrl = 'https://retro-vault-backend.onrender.com'
  var copyrightNotice =
    '© 2026 James Revert / Retro Vault Elite. All rights reserved. No site copy, branding, or original material may be reused without written permission or a paid licence.'

  function decorateFooter() {
    try {
      var footers = document.querySelectorAll('.seo-footer')
      if (!footers.length) return
      footers.forEach(function (footer) {
        if (!footer || footer.querySelector('.copyright-note')) return
        var note = document.createElement('small')
        note.className = 'copyright-note'
        note.style.display = 'block'
        note.style.marginTop = '12px'
        note.textContent = copyrightNotice
        footer.appendChild(note)
      })
    } catch (error) {
      // Footer decoration must never break page load.
    }
  }

  function sendPageView() {
    try {
      fetch(apiBaseUrl + '/analytics/page-view', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: window.location.pathname,
          referrer: document.referrer,
          title: document.title,
          signedIn: false,
        }),
      }).catch(function () {})
    } catch (error) {
      // Analytics must never block static pages.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      function () {
        decorateFooter()
        sendPageView()
      },
      { once: true }
    )
  } else {
    decorateFooter()
    sendPageView()
  }
})()
