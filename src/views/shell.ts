export function renderShell(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JBCHUSA · 교인관리시스템</title>
  <link rel="icon" type="image/png" href="/static/logo.png" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
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
</head>
<body class="bg-slate-100 text-slate-800 antialiased">
  <div id="app"></div>
  <div id="modal-root"></div>
  <div id="toast-root" class="fixed top-4 right-4 z-[100] space-y-2"></div>
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
