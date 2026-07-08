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
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = String(now.getMonth() + 1).padStart(2, '0');
  const defaultTrend = 'weekly';
  const defaultFromYear = '';
  const defaultToYear = '';
  const [{ data: d }, { data: md }, { data: gd }] = await Promise.all([
    api.get('/attendance/dashboard', { params: { trend: defaultTrend } }),
    api.get('/attendance/meetings', { params: { year: defaultYear, month: defaultMonth } }),
    api.get('/orgs/groups'),
  ]);

  const totalPresent = d.statusDist.filter((s)=>['present','online','late'].includes(s.status)).reduce((a,s)=>a+s.n,0);
  const totalRecords = d.statusDist.reduce((a,s)=>a+s.n,0);
  const rate = totalRecords ? Math.round(totalPresent/totalRecords*100) : 0;

  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div><h2 class="text-xl font-bold text-slate-800">${t('att.dashboard')}</h2><p class="text-sm text-slate-500">${t('att.dashboard_desc')}</p></div>
      ${hasPerm('meeting.manage')?`<button onclick="createMeeting()" class="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>${t('att.add_meeting')}</button>`:''}
    </div>

    <div class="card p-3 mb-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="text-sm font-semibold text-slate-600">${t('att.range_title')}</div>
        <div class="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <span>${t('att.trend_from')}</span>
          <select id="dash-from-year" class="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"></select>
          <select id="dash-from-month" class="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"></select>
          <span>${t('att.trend_to')}</span>
          <select id="dash-to-year" class="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"></select>
          <select id="dash-to-month" class="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"></select>
        </div>
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <span>${t('att.range_preset')}</span>
          <select id="dash-range-preset" class="px-2 py-1.5 border border-slate-200 rounded-lg text-xs">
            <option value="all">${t('att.range_all')}</option>
            <option value="3m">${t('att.range_3m')}</option>
            <option value="6m">${t('att.range_6m')}</option>
            <option value="12m">${t('att.range_12m')}</option>
          </select>
        </div>
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <span>${t('att.group_filter')}</span>
          <select id="dash-group" class="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"></select>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${statCard(t('att.active_members'),'fa-users','text-brand-600',d.totalMembers,'stat-active-members')}
      ${statCard(t('att.total_meetings'),'fa-calendar-check','text-purple-600',d.totalMeetings,'stat-total-meetings')}
      ${statCard(t('att.avg_rate'),'fa-percent','text-emerald-600',rate+'%','stat-avg-rate')}
      ${statCard(t('att.records'),'fa-clipboard-list','text-amber-600',totalRecords,'stat-records')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <div class="card p-5 lg:col-span-2">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 class="font-bold text-slate-700">${t('att.trend_title')}</h3>
          <div class="flex flex-wrap items-center gap-2">
            <select id="trend-period" class="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="weekly">${t('att.trend_week')}</option>
              <option value="monthly">${t('att.trend_month')}</option>
              <option value="yearly">${t('att.trend_year')}</option>
            </select>
            <div class="flex items-center gap-1 text-xs text-slate-500">
              <span>${t('att.trend_from')}</span>
              <select id="trend-from-year" class="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"></select>
              <span>${t('att.trend_to')}</span>
              <select id="trend-to-year" class="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"></select>
            </div>
          </div>
        </div>
        <canvas id="trend-chart" height="120"></canvas>
      </div>
      <div class="card p-5">
        <h3 class="font-bold text-slate-700 mb-3">${t('att.status_dist')}</h3>
        <canvas id="status-chart" height="160"></canvas>
      </div>
    </div>

    <div class="card p-5">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 class="font-bold text-slate-700">${t('att.meeting_list')}</h3>
        <div class="flex items-center gap-2">
          <select id="att-year" class="px-3 py-2 border border-slate-200 rounded-lg text-sm"></select>
          <select id="att-month" class="px-3 py-2 border border-slate-200 rounded-lg text-sm"></select>
        </div>
      </div>
      <div id="meeting-list" class="space-y-2"></div>
    </div>`;

  const yearSelect = el('att-year');
  const monthSelect = el('att-month');
  const yearOptions = [
    { value: '', label: t('att.filter_all') },
    ...Array.from({ length: 5 }, (_, i) => ({
      value: String(defaultYear - i),
      label: String(defaultYear - i),
    })),
  ];
  yearSelect.innerHTML = yearOptions.map((o)=>`<option value="${o.value}" ${o.value===String(defaultYear)?'selected':''}>${esc(o.label)}</option>`).join('');
  const meetingMonthOptions = [
    { value: '', label: t('att.filter_all') },
    ...Array.from({ length: 12 }, (_, i) => {
      const value = String(i + 1).padStart(2, '0');
      return { value, label: `${value}${getLang()==='ko' ? t('att.month_unit') : ''}` };
    }),
  ];
  monthSelect.innerHTML = meetingMonthOptions.map((o)=>`<option value="${o.value}" ${o.value===defaultMonth?'selected':''}>${esc(o.label)}</option>`).join('');

  async function loadMeetingList() {
    const year = yearSelect.value;
    const month = monthSelect.value;
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    const { data } = await api.get('/attendance/meetings', { params });
    const list = el('meeting-list');
    list.innerHTML = (data.meetings||[]).map(meetingRow).join('') || `<div class="text-sm text-slate-400 py-6 text-center">${t('att.no_meetings')}</div>`;
  }
  yearSelect.addEventListener('change', loadMeetingList);
  monthSelect.addEventListener('change', loadMeetingList);
  const list = el('meeting-list');
  list.innerHTML = (md.meetings||[]).map(meetingRow).join('') || `<div class="text-sm text-slate-400 py-6 text-center">${t('att.no_meetings')}</div>`;

  const trendSelect = el('trend-period');
  const trendFromYear = el('trend-from-year');
  const trendToYear = el('trend-to-year');
  const dashFromYear = el('dash-from-year');
  const dashToYear = el('dash-to-year');
  const dashFromMonth = el('dash-from-month');
  const dashToMonth = el('dash-to-month');
  const dashPreset = el('dash-range-preset');
  const dashGroup = el('dash-group');
  if (trendSelect) trendSelect.value = d.trend_period || defaultTrend;

  const dashboardMonthOptions = [
    { value: '', label: t('att.filter_all') },
    ...Array.from({ length: 12 }, (_, i) => {
      const value = String(i + 1).padStart(2, '0');
      return { value, label: getLang()==='ko' ? `${value}월` : value };
    }),
  ].map((o)=>`<option value="${o.value}">${esc(o.label)}</option>`).join('');

  if (dashFromMonth) { dashFromMonth.innerHTML = dashboardMonthOptions; }
  if (dashToMonth) { dashToMonth.innerHTML = dashboardMonthOptions; }

  const updateYearOptions = (range) => {
    const minYear = range?.min_year ? parseInt(range.min_year, 10) : defaultYear;
    const maxYear = range?.max_year ? parseInt(range.max_year, 10) : defaultYear;
    const years = [];
    for (let y = maxYear; y >= minYear; y -= 1) years.push(String(y));
    const yearOptions = years.map((y)=>`<option value="${y}">${y}</option>`).join('');
    if (dashFromYear) { dashFromYear.innerHTML = yearOptions; dashFromYear.value = String(minYear); }
    if (dashToYear) { dashToYear.innerHTML = yearOptions; dashToYear.value = String(maxYear); }
    if (trendFromYear) { trendFromYear.innerHTML = yearOptions; trendFromYear.value = String(minYear); }
    if (trendToYear) { trendToYear.innerHTML = yearOptions; trendToYear.value = String(maxYear); }
    if (dashFromMonth) dashFromMonth.value = '';
    if (dashToMonth) dashToMonth.value = '';
  };

  updateYearOptions(d.range);

  if (dashGroup) {
    const groups = (gd.groups || []).filter((g)=>g.meeting_count !== 0 || g.member_count !== 0 || g.group_id);
    dashGroup.innerHTML = `<option value="">${t('att.range_all')}</option>` + groups.map((g)=>`<option value="${g.group_id}">${esc(g.name)}</option>`).join('');
  }

  const syncDashboardRange = () => {
    if (dashFromYear && dashToYear && dashFromYear.value && dashToYear.value && dashFromYear.value > dashToYear.value) {
      dashToYear.value = dashFromYear.value;
    }
    if (dashFromYear && dashToYear && dashFromMonth && dashToMonth && dashFromYear.value === dashToYear.value) {
      if (dashFromMonth.value && dashToMonth.value && dashFromMonth.value > dashToMonth.value) {
        dashToMonth.value = dashFromMonth.value;
      }
    }
  };

  const getDashboardParams = () => {
    const params = { trend: trendSelect?.value || defaultTrend };
    if (dashFromYear?.value) params.from_year = dashFromYear.value;
    if (dashToYear?.value) params.to_year = dashToYear.value;
    if (dashFromMonth?.value) params.from_month = dashFromMonth.value;
    if (dashToMonth?.value) params.to_month = dashToMonth.value;
    if (dashGroup?.value) params.group_id = dashGroup.value;
    return params;
  };

  const formatTrendLabel = (value, period) => {
    if (!value) return '';
    if (period === 'monthly') {
      return getLang()==='ko' ? `${value.slice(0,4)}년 ${value.slice(5,7)}월` : `${value.slice(0,4)}-${value.slice(5,7)}`;
    }
    if (period === 'yearly') {
      return getLang()==='ko' ? `${value}년` : value;
    }
    return getLang()==='ko' ? `${value.slice(5,7)}월 ${value.slice(8,10)}일` : `${value.slice(5,7)}/${value.slice(8,10)}`;
  };

  // charts (Chart.js lazy-loaded; if CDN unavailable, charts are simply skipped)
  const chartReady = await ensureChart();
  if (chartReady && el('trend-chart')) {
    let trendChart = null;
    let statusChart = null;
    const buildTrendChart = (trendData, period) => {
      const labels = (trendData||[]).map((t)=>formatTrendLabel(t.d, period));
      const present = (trendData||[]).map((x)=>x.present || 0);
      const total = (trendData||[]).map((x)=>x.total || 0);
      if (trendChart) {
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = present;
        trendChart.data.datasets[1].data = total;
        trendChart.update();
        return;
      }
      trendChart = new Chart(el('trend-chart'), {
        type: 'line',
        data: {
          labels,
          datasets: [{ label:t('att.present_label'), data:present, borderColor:'#1e6fd9', backgroundColor:'rgba(30,111,217,.1)', fill:true, tension:.3 },
                     { label:t('att.total_label'), data:total, borderColor:'#cbd5e1', borderDash:[4,4], fill:false, tension:.3 }] },
        options: { responsive:true, plugins:{legend:{display:true, labels:{boxWidth:12}}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}} }
      });
    };
    const buildStatusChart = (statusData) => {
      const labels = (statusData||[]).map((s)=>statusLabel(s.status));
      const values = (statusData||[]).map((s)=>s.n);
      if (statusChart) {
        statusChart.data.labels = labels;
        statusChart.data.datasets[0].data = values;
        statusChart.update();
        return;
      }
      statusChart = new Chart(el('status-chart'), {
        type: 'doughnut',
        data: { labels, datasets:[{ data: values, backgroundColor:['#10b981','#f87171','#fbbf24','#60a5fa','#fb923c'] }] },
        options: { responsive:true, plugins:{legend:{position:'bottom', labels:{boxWidth:12,font:{size:11}}}} }
      });
    };

    const updateStatCards = (data) => {
      const totalPresent = data.statusDist.filter((s)=>['present','online','late'].includes(s.status)).reduce((a,s)=>a+s.n,0);
      const totalRecords = data.statusDist.reduce((a,s)=>a+s.n,0);
      const rate = totalRecords ? Math.round(totalPresent/totalRecords*100) : 0;
      const statActive = el('stat-active-members');
      const statMeetings = el('stat-total-meetings');
      const statRate = el('stat-avg-rate');
      const statRecords = el('stat-records');
      if (statActive) statActive.textContent = String(data.totalMembers || 0);
      if (statMeetings) statMeetings.textContent = String(data.totalMeetings || 0);
      if (statRate) statRate.textContent = `${rate}%`;
      if (statRecords) statRecords.textContent = String(totalRecords);
    };

    const reloadDashboard = async (refreshRange = false) => {
      syncDashboardRange();
      const { data: td } = await api.get('/attendance/dashboard', { params: getDashboardParams() });
      if (refreshRange && td.range) {
        updateYearOptions(td.range);
      }
      updateStatCards(td);
      buildTrendChart(td.trend || [], td.trend_period || trendSelect?.value || defaultTrend);
      buildStatusChart(td.statusDist || []);
    };

    buildTrendChart(d.trend || [], trendSelect?.value || defaultTrend);
    buildStatusChart(d.statusDist || []);

    const applyPreset = (preset) => {
      if (!dashFromYear || !dashToYear || !dashFromMonth || !dashToMonth) return;
      if (preset === 'all') {
        updateYearOptions(d.range);
        return;
      }
      const now = new Date();
      const offset = preset === '3m' ? 2 : preset === '6m' ? 5 : 11;
      const endYear = now.getFullYear();
      const endMonth = now.getMonth() + 1;
      const start = new Date(endYear, endMonth - 1 - offset, 1);
      dashFromYear.value = String(start.getFullYear());
      dashFromMonth.value = String(start.getMonth() + 1).padStart(2, '0');
      dashToYear.value = String(endYear);
      dashToMonth.value = String(endMonth).padStart(2, '0');
      if (trendFromYear) trendFromYear.value = dashFromYear.value;
      if (trendToYear) trendToYear.value = dashToYear.value;
    };

    if (trendSelect) trendSelect.addEventListener('change', reloadDashboard);
    if (dashFromYear) dashFromYear.addEventListener('change', () => {
      if (trendFromYear) trendFromYear.value = dashFromYear.value;
      reloadDashboard();
    });
    if (dashToYear) dashToYear.addEventListener('change', () => {
      if (trendToYear) trendToYear.value = dashToYear.value;
      reloadDashboard();
    });
    if (dashFromMonth) dashFromMonth.addEventListener('change', reloadDashboard);
    if (dashToMonth) dashToMonth.addEventListener('change', reloadDashboard);
    if (trendFromYear) trendFromYear.addEventListener('change', () => {
      if (dashFromYear) dashFromYear.value = trendFromYear.value;
      reloadDashboard();
    });
    if (trendToYear) trendToYear.addEventListener('change', () => {
      if (dashToYear) dashToYear.value = trendToYear.value;
      reloadDashboard();
    });
    if (dashGroup) dashGroup.addEventListener('change', () => reloadDashboard(true));
    if (dashPreset) {
      dashPreset.value = 'all';
      dashPreset.addEventListener('change', () => { applyPreset(dashPreset.value); reloadDashboard(); });
    }

    updateStatCards(d);
  } else if (!chartReady) {
    ['trend-chart','status-chart'].forEach((id)=>{ const c=el(id); if(c) c.replaceWith(h(`<div class="text-sm text-slate-400 py-8 text-center">${t('att.chart_unavailable')}</div>`)); });
  }
}

function statCard(label, icon, color, value, valueId) {
  return `<div class="card p-4">
    <div class="flex items-center justify-between"><span class="text-xs text-slate-500">${label}</span><i class="fas ${icon} ${color}"></i></div>
    <div class="text-2xl font-bold text-slate-800 mt-2" id="${valueId||''}">${value}</div></div>`;
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

async function createMeeting() { return meetingForm(null); }
async function editMeeting(meeting) { return meetingForm(meeting); }

async function meetingForm(editing) {
  const m = editing || {};
  const { data } = await api.get('/orgs/groups');
  const gOpts = data.groups.map((g)=>`<option value="${g.group_id}" ${m.group_id==g.group_id?'selected':''}>[${catLabel(g.category_code)}] ${esc(g.name)}</option>`).join('');
  const types = ['주일예배','수요예배','구역예배','교구모임','부서모임','교회학교','새벽기도','특별집회','기타'];
  const today = new Date().toISOString().slice(0,10);
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${editing?t('att.edit_meeting'):t('att.add_meeting')}</h3>
    <form id="mt-form" class="space-y-3">
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.org')}</label><select name="group_id" class="w-full px-3 py-2.5 border rounded-lg">${gOpts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.title')}</label><input name="title" required value="${esc(m.title||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('mtype.주일예배')}" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.type')}</label><select name="meeting_type" class="w-full px-3 py-2.5 border rounded-lg">${types.map((ty)=>`<option value="${ty}" ${m.meeting_type===ty?'selected':''}>${t('mtype.'+ty)}</option>`).join('')}</select></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.date')}</label><input type="date" name="meeting_date" value="${esc(m.meeting_date||today)}" class="w-full px-3 py-2.5 border rounded-lg" /></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.time')}</label><input type="time" name="start_time" value="${esc(m.start_time||'')}" class="w-full px-3 py-2.5 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.location')}</label><input name="location" value="${esc(m.location||'')}" class="w-full px-3 py-2.5 border rounded-lg" /></div>
      </div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.address')}</label><input name="address" value="${esc(m.address||'')}" class="w-full px-3 py-2.5 border rounded-lg" /></div>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${editing?t('common.save'):t('common.register')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#mt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try {
      if (editing) {
        await api.put(`/attendance/meetings/${editing.meeting_id}`, payload);
        closeModal(); toast(t('att.meeting_updated'), 'success');
        location.hash = `#/attendance/meeting/${editing.meeting_id}`; router();
      } else {
        const { data } = await api.post('/attendance/meetings', payload);
        closeModal(); toast(t('att.meeting_added'), 'success');
        location.hash = `#/attendance/meeting/${data.meeting_id}`;
      }
    } catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

/* ---- delete a meeting ---- */
async function deleteMeeting(meetingId, title) {
  if (!confirm(t('att.del_meeting_confirm', { title }))) return;
  try {
    await api.delete(`/attendance/meetings/${meetingId}`);
    toast(t('att.meeting_deleted'), 'success');
    location.hash = '#/attendance';
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}

async function attendanceMeeting(content, meetingId) {
  content.innerHTML = loadingHtml();
  const { data } = await api.get(`/attendance/meetings/${meetingId}`);
  const m = data.meeting;
  const roster = data.roster || [];
  const canEdit = hasPerm('attendance.edit');
  const canManage = hasPerm('meeting.manage');

  content.innerHTML = `
    <div class="mb-4"><a href="#/attendance" class="text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-arrow-left mr-1"></i>${t('att.back_dashboard')}</a></div>
    <div class="card p-5 mb-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-bold text-slate-800">${esc(m.title)}</h2>
          <p class="text-sm text-slate-500">${esc(m.group_name)} · ${esc(t('mtype.' + m.meeting_type))} · ${esc(m.meeting_date)}${m.start_time?` ${esc(m.start_time)}`:''}${m.location?` · ${esc(m.location)}`:''}${m.address?` · ${esc(m.address)}`:''}</p>
        </div>
        ${canManage?`<div class="flex items-center gap-2 shrink-0">
          <button onclick='editMeeting(${JSON.stringify(m)})' title="${t('common.edit')}" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-600"><i class="fas fa-pen text-xs"></i></button>
          <button onclick='deleteMeeting(${m.meeting_id}, ${JSON.stringify(m.title)})' title="${t('common.delete')}" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button>
        </div>`:''}
      </div>
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
