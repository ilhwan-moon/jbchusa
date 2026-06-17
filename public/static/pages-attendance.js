/* ============================================================
 * Attendance management: dashboard + meetings + recording
 * ============================================================ */
Pages.attendance = async function (content, sub) {
  if (sub[0] === 'meeting' && sub[1]) return attendanceMeeting(content, sub[1]);
  return attendanceDashboard(content);
};

function statusLabel(s) { return (typeof t === 'function') ? t('st.' + s) : s; }
const STATUS_COLOR = { present:'bg-emerald-500', absent:'bg-red-400', excused:'bg-amber-400', online:'bg-blue-400', late:'bg-orange-400' };

async function attendanceDashboard(content) {
  content.innerHTML = loadingHtml();
  const [{ data: d }, { data: md }] = await Promise.all([
    api.get('/attendance/dashboard'),
    api.get('/attendance/meetings'),
  ]);

  const totalPresent = d.statusDist.filter((s)=>['present','online','late'].includes(s.status)).reduce((a,s)=>a+s.n,0);
  const totalRecords = d.statusDist.reduce((a,s)=>a+s.n,0);
  const rate = totalRecords ? Math.round(totalPresent/totalRecords*100) : 0;

  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div><h2 class="text-xl font-bold text-slate-800">${t('att.dashboard')}</h2><p class="text-sm text-slate-500">${t('att.dashboard_desc')}</p></div>
      ${hasPerm('meeting.manage')?`<button onclick="createMeeting()" class="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>${t('att.add_meeting')}</button>`:''}
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${statCard(t('att.active_members'),'fa-users','text-brand-600',d.totalMembers)}
      ${statCard(t('att.total_meetings'),'fa-calendar-check','text-purple-600',d.totalMeetings)}
      ${statCard(t('att.avg_rate'),'fa-percent','text-emerald-600',rate+'%')}
      ${statCard(t('att.records'),'fa-clipboard-list','text-amber-600',totalRecords)}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <div class="card p-5 lg:col-span-2">
        <h3 class="font-bold text-slate-700 mb-3">${t('att.weekly_trend')}</h3>
        <canvas id="trend-chart" height="120"></canvas>
      </div>
      <div class="card p-5">
        <h3 class="font-bold text-slate-700 mb-3">${t('att.status_dist')}</h3>
        <canvas id="status-chart" height="160"></canvas>
      </div>
    </div>

    <div class="card p-5">
      <h3 class="font-bold text-slate-700 mb-3">${t('att.meeting_list')}</h3>
      <div class="space-y-2">
        ${(md.meetings||[]).map(meetingRow).join('') || `<div class="text-sm text-slate-400 py-6 text-center">${t('att.no_meetings')}</div>`}
      </div>
    </div>`;

  // charts (Chart.js lazy-loaded; if CDN unavailable, charts are simply skipped)
  const chartReady = await ensureChart();
  if (chartReady && el('trend-chart')) {
    new Chart(el('trend-chart'), {
      type: 'line',
      data: {
        labels: d.trend.map((t)=>t.d?.slice(5)||''),
        datasets: [{ label:t('att.present_label'), data:d.trend.map((x)=>x.present), borderColor:'#1e6fd9', backgroundColor:'rgba(30,111,217,.1)', fill:true, tension:.3 },
                   { label:t('att.total_label'), data:d.trend.map((x)=>x.total), borderColor:'#cbd5e1', borderDash:[4,4], fill:false, tension:.3 }] },
      options: { responsive:true, plugins:{legend:{display:true, labels:{boxWidth:12}}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}} }
    });
    new Chart(el('status-chart'), {
      type: 'doughnut',
      data: { labels: d.statusDist.map((s)=>statusLabel(s.status)),
        datasets:[{ data:d.statusDist.map((s)=>s.n), backgroundColor:['#10b981','#f87171','#fbbf24','#60a5fa','#fb923c'] }] },
      options: { responsive:true, plugins:{legend:{position:'bottom', labels:{boxWidth:12,font:{size:11}}}} }
    });
  } else if (!chartReady) {
    ['trend-chart','status-chart'].forEach((id)=>{ const c=el(id); if(c) c.replaceWith(h(`<div class="text-sm text-slate-400 py-8 text-center">${t('att.chart_unavailable')}</div>`)); });
  }
}

function statCard(label, icon, color, value) {
  return `<div class="card p-4">
    <div class="flex items-center justify-between"><span class="text-xs text-slate-500">${label}</span><i class="fas ${icon} ${color}"></i></div>
    <div class="text-2xl font-bold text-slate-800 mt-2">${value}</div></div>`;
}

function meetingRow(m) {
  const rate = m.total ? Math.round(m.present/m.total*100) : 0;
  return `<a href="#/attendance/meeting/${m.meeting_id}" class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50/40">
    <div class="w-11 h-11 rounded-lg bg-slate-100 flex flex-col items-center justify-center text-brand-700">
      <span class="text-[10px] leading-none">${(m.meeting_date||'').slice(5,7)}${getLang()==='ko'?'월':''}</span><span class="font-bold leading-none">${(m.meeting_date||'').slice(8,10)}</span></div>
    <div class="flex-1 min-w-0">
      <div class="font-semibold text-slate-800 text-sm truncate">${esc(m.title)}</div>
      <div class="text-xs text-slate-400 truncate">${esc(m.group_name)} · ${esc(t('mtype.' + m.meeting_type))}</div>
    </div>
    <div class="text-right"><div class="text-sm font-bold text-slate-700">${m.present}/${m.total}</div><div class="text-[11px] text-slate-400">${rate}%</div></div>
    <i class="fas fa-chevron-right text-slate-300 text-xs"></i>
  </a>`;
}

async function createMeeting() {
  const { data } = await api.get('/orgs/groups');
  const gOpts = data.groups.map((g)=>`<option value="${g.group_id}">[${catLabel(g.category_code)}] ${esc(g.name)}</option>`).join('');
  const types = ['주일예배','수요예배','구역예배','교구모임','부서모임','교회학교','새벽기도','특별집회','기타'];
  const today = new Date().toISOString().slice(0,10);
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('att.add_meeting')}</h3>
    <form id="mt-form" class="space-y-3">
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.org')}</label><select name="group_id" class="w-full px-3 py-2.5 border rounded-lg">${gOpts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.title')}</label><input name="title" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('mtype.주일예배')}" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.type')}</label><select name="meeting_type" class="w-full px-3 py-2.5 border rounded-lg">${types.map((ty)=>`<option value="${ty}">${t('mtype.'+ty)}</option>`).join('')}</select></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.date')}</label><input type="date" name="meeting_date" value="${today}" class="w-full px-3 py-2.5 border rounded-lg" /></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.time')}</label><input type="time" name="start_time" class="w-full px-3 py-2.5 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.location')}</label><input name="location" class="w-full px-3 py-2.5 border rounded-lg" /></div>
      </div>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.register')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#mt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/attendance/meetings', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast(t('att.meeting_added'), 'success');
      location.hash = `#/attendance/meeting/${data.meeting_id}`;
    } catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

async function attendanceMeeting(content, meetingId) {
  content.innerHTML = loadingHtml();
  const { data } = await api.get(`/attendance/meetings/${meetingId}`);
  const m = data.meeting;
  const roster = data.roster || [];
  const canEdit = hasPerm('attendance.edit');

  content.innerHTML = `
    <div class="mb-4"><a href="#/attendance" class="text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-arrow-left mr-1"></i>${t('att.back_dashboard')}</a></div>
    <div class="card p-5 mb-4">
      <h2 class="text-lg font-bold text-slate-800">${esc(m.title)}</h2>
      <p class="text-sm text-slate-500">${esc(m.group_name)} · ${esc(t('mtype.' + m.meeting_type))} · ${esc(m.meeting_date)}${m.start_time?` ${esc(m.start_time)}`:''}${m.location?` · ${esc(m.location)}`:''}</p>
    </div>
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-slate-700">${t('att.roster')} (${roster.length}${t('common.people_unit')})</h3>
        ${canEdit?`<div class="flex gap-2">
          <button onclick="bulkSet('present')" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-medium">${t('att.all_present')}</button>
          <button onclick="bulkSet('absent')" class="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-medium">${t('att.all_absent')}</button>
        </div>`:''}
      </div>
      <div id="roster" class="space-y-2">
        ${roster.map((r)=>rosterRow(r, canEdit)).join('') || `<div class="text-sm text-slate-400 py-6 text-center">${t('att.no_members_in_org')}</div>`}
      </div>
      ${canEdit && roster.length?`<button onclick="saveAttendance(${meetingId})" class="mt-4 w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold"><i class="fas fa-save mr-1"></i>${t('att.save')}</button>`:''}
    </div>`;
}

function rosterRow(r, canEdit) {
  const name = r.korean_name || `${r.first_name} ${r.last_name}`;
  const cur = r.status || 'present';
  const statuses = ['present','absent','excused','online','late'];
  return `<div class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100" data-member="${r.member_id}">
    ${avatar(r.photo_url, r.first_name, r.last_name, 'w-9 h-9')}
    <div class="flex-1 min-w-0"><div class="text-sm font-medium text-slate-800 truncate">${esc(name)}</div>${r.title?`<div class="text-xs text-slate-400">${esc(r.title)}</div>`:''}</div>
    ${canEdit ? `<div class="flex gap-1 flex-wrap justify-end">${statuses.map((s)=>`
      <button data-status="${s}" onclick="setStatus(${r.member_id},'${s}')" class="att-btn text-[11px] px-2 py-1 rounded-md ${s===cur?STATUS_COLOR[s]+' text-white':'bg-slate-100 text-slate-500'}">${statusLabel(s)}</button>`).join('')}</div>`
      : `<span class="badge ${STATUS_COLOR[cur]} text-white">${statusLabel(cur)}</span>`}
  </div>`;
}

function setStatus(memberId, status) {
  const row = document.querySelector(`#roster [data-member="${memberId}"]`);
  row.dataset.status = status;
  row.querySelectorAll('.att-btn').forEach((b) => {
    const s = b.dataset.status;
    b.className = `att-btn text-[11px] px-2 py-1 rounded-md ${s===status?STATUS_COLOR[s]+' text-white':'bg-slate-100 text-slate-500'}`;
  });
}
function bulkSet(status) {
  document.querySelectorAll('#roster [data-member]').forEach((row) => setStatus(parseInt(row.dataset.member,10), status));
}
async function saveAttendance(meetingId) {
  const records = [...document.querySelectorAll('#roster [data-member]')].map((row) => ({
    member_id: parseInt(row.dataset.member,10), status: row.dataset.status || 'present',
  }));
  try {
    await api.post(`/attendance/meetings/${meetingId}/record`, { records });
    toast(t('att.saved_count', { n: records.length }), 'success');
  } catch (err) { toast(err.response?.data?.error || t('att.save_failed'), 'error'); }
}
