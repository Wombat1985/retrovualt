;(function () {
  var apiBaseUrl = 'https://retro-vault-backend.onrender.com'

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
    document.addEventListener('DOMContentLoaded', sendPageView, { once: true })
  } else {
    sendPageView()
  }
})()
