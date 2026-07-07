export function renderShell(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JBCHUSA · 성도교제관리</title>
  <link rel="icon" type="image/png" href="/static/logo.png" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: { 50:'#eff6ff',100:'#dbeafe',500:'#1e6fd9',600:'#1559b8',700:'#114a99',800:'#0d3a78',900:'#0a2c5c' }
          }
        }
      }
    }
  </script>
  <link href="/static/style.css" rel="stylesheet" />
  <style>
    #boot { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0a2c5c; z-index:9999; transition:opacity .3s; }
    #boot .ring { width:48px; height:48px; border:4px solid rgba(255,255,255,.25); border-top-color:#fff; border-radius:50%; animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg);} }
  </style>
</head>
<body class="bg-slate-100 text-slate-800 antialiased">
  <div id="boot">
    <img src="/static/logo.png" style="width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.1);padding:8px;margin-bottom:18px;" />
    <div class="ring"></div>
    <div style="color:#cfe0ff;font-size:13px;margin-top:16px;">JBCHUSA 불러오는 중...</div>
    <div id="boot-err" style="color:#ffd0d0;font-size:12px;margin-top:14px;max-width:300px;text-align:center;display:none;"></div>
  </div>
  <div id="app"></div>
  <div id="modal-root"></div>
  <div id="toast-root" class="fixed top-4 right-4 z-[100] space-y-2"></div>

  <script>
    // Fail-safe: if axios (required) didn't load from CDN, show a clear message instead of infinite spinner.
    window.__bootFail = function (msg) {
      var b = document.getElementById('boot-err');
      if (b) { b.style.display = 'block'; b.textContent = msg; }
    };
    window.addEventListener('load', function () {
      // localize boot text once i18n is available
      try {
        if (typeof window.t === 'function') {
          var bt = document.querySelector('#boot > div:last-of-type, #boot div');
        }
      } catch (e) {}
      setTimeout(function () {
        if (typeof axios === 'undefined') {
          var msg = (typeof window.t === 'function') ? window.t('app.net_error') : '네트워크 문제로 일부 리소스를 불러오지 못했습니다. 새로고침 해주세요.';
          window.__bootFail(msg);
        }
      }, 6000);
    });
  </script>

  <script src="/static/i18n.js"></script>
  <script src="/static/app.js"></script>
  <script src="/static/layout.js"></script>
  <script src="/static/pages-auth.js"></script>
  <script src="/static/pages-orgs.js"></script>
  <script src="/static/pages-member.js"></script>
  <script src="/static/pages-attendance.js"></script>
  <script src="/static/pages-misc.js"></script>
</body>
</html>`
}
