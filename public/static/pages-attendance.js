/* ============================================================
 * Attendance management: dashboard + meetings + recording
 * ============================================================ */
Pages.attendance = async function (content, sub) {
  if (sub[0] === 'meeting' && sub[1]) return attendanceMeeting(content, sub[1]);
  return attendanceDashboard(content);
};

function statusLabel(s) { return (typeof t === 'function') ? t('st.' + s) : s; }
function reasonLabel(reasonId) {
  const list = window.__absenceReasons || [];
  const found = list.find((r) => String(r.reason_id) === String(reasonId));
  return found ? localizeMetaName(found) : '';
}
const STATUS_COLOR = { present:'bg-emerald-500', absent:'bg-red-400' };

function buildRepeatInfo(m) {
  if (!m || !m.series_id) return '';
  const freqLabel = m.series_freq === 'monthly' ? t('att.repeat_monthly') : t('att.repeat_weekly');
  const interval = parseInt(m.series_interval || 1, 10) || 1;
  const unitLabel = m.series_freq === 'monthly' ? t('att.repeat_month_unit') : t('att.repeat_week_unit');
  const untilText = m.series_until_date ? ` · ${t('att.repeat_until')}: ${m.series_until_date}` : '';
  return `${t('att.repeat_label')}: ${freqLabel} (${interval}${unitLabel})${untilText}`;
}


async function attendanceDashboard(content) {
  content.innerHTML = loadingHtml();
  const now = new Date();
  const baseYear = now.getFullYear();
  const defaultYear = baseYear;
  const defaultMonth = String(now.getMonth() + 1).padStart(2, '0');
  const defaultTrend = 'weekly';
  const defaultFromYear = '';
  const defaultToYear = '';
  const [{ data: d }, { data: md }, { data: gd }] = await Promise.all([
    api.get('/attendance/dashboard', { params: { trend: defaultTrend } }),
    api.get('/attendance/meetings', { params: { year: defaultYear, month: defaultMonth } }),
    api.get('/orgs/groups'),
  ]);

  const totalPresent = d.statusDist.filter((s)=>['present'].includes(s.status)).reduce((a,s)=>a+s.n,0);
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
          <button id="att-show-all" class="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">${t('att.show_all')}</button>
        </div>
      </div>
      <div id="meeting-list" class="space-y-2"></div>
    </div>`;

  const yearSelect = el('att-year');
  const monthSelect = el('att-month');
  const showAllBtn = el('att-show-all');
  const yearOptions = [
    { value: '', label: t('att.filter_all') },
    ...Array.from({ length: 5 }, (_, i) => ({
      value: String(baseYear - i),
      label: String(baseYear - i),
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
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      yearSelect.value = '';
      monthSelect.value = '';
      loadMeetingList();
    });
  }
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
    const minYear = range?.min_year ? parseInt(range.min_year, 10) : baseYear;
    const maxYear = range?.max_year ? parseInt(range.max_year, 10) : baseYear;
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
        data: { labels, datasets:[{ data: values, backgroundColor:['#10b981','#f87171'] }] },
        options: { responsive:true, plugins:{legend:{position:'bottom', labels:{boxWidth:12,font:{size:11}}}} }
      });
    };

    const updateStatCards = (data) => {
      const totalPresent = data.statusDist.filter((s)=>['present'].includes(s.status)).reduce((a,s)=>a+s.n,0);
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
  const isSeries = !!m.series_id;
  const repeatInfo = buildRepeatInfo(m);
  const { data } = await api.get('/orgs/groups');
  const gOpts = data.groups.map((g)=>`<option value="${g.group_id}" ${m.group_id==g.group_id?'selected':''}>[${catLabel(g.category_code)}] ${esc(g.name)}</option>`).join('');
  const types = ['주일예배','수요예배','구역예배','교구모임','부서모임','교회학교','새벽기도','특별집회','기타'];
  const today = new Date().toISOString().slice(0,10);
  const repeatUntilDefault = m.series_until_date || new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0,10);
  const repeatFields = editing ? '' : `
      <div class="border-t pt-3">
        <label class="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" id="repeat-enabled" name="repeat_enabled" class="rounded border-slate-300" />
          ${t('att.repeat_label')}
        </label>
        <div id="repeat-fields" class="mt-3 space-y-3 hidden">
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.repeat_freq')}</label>
              <select name="repeat_freq" class="w-full px-3 py-2.5 border rounded-lg">
                <option value="weekly">${t('att.repeat_weekly')}</option>
                <option value="monthly">${t('att.repeat_monthly')}</option>
              </select>
            </div>
            <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.repeat_interval')}</label>
              <input type="number" name="repeat_interval" min="1" value="1" class="w-full px-3 py-2.5 border rounded-lg" />
            </div>
          </div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.repeat_until')}</label>
            <input type="date" name="repeat_until" value="${repeatUntilDefault}" class="w-full px-3 py-2.5 border rounded-lg" />
          </div>
        </div>
      </div>`;
  const seriesScope = isSeries ? `
      <div class="border-t pt-3 space-y-2">
        <div class="text-[11px] text-slate-500">${esc(repeatInfo)}</div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.repeat_scope')}</label>
          <select name="repeat_scope" class="w-full px-3 py-2.5 border rounded-lg">
            <option value="this">${t('att.scope_this')}</option>
            <option value="future">${t('att.scope_future')}</option>
            <option value="past">${t('att.scope_past')}</option>
            <option value="all">${t('att.scope_all')}</option>
          </select>
          <p class="text-[11px] text-slate-400 mt-1">${t('att.repeat_scope_desc')}</p>
        </div>
      </div>` : '';

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
      ${repeatFields}
      ${seriesScope}
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${editing?t('common.save'):t('common.register')}</button></div>
    </form></div>`);
  openModal(box);

  const repeatToggle = box.querySelector('#repeat-enabled');
  const repeatBlock = box.querySelector('#repeat-fields');
  if (repeatToggle && repeatBlock) {
    const syncRepeat = () => { repeatBlock.classList.toggle('hidden', !repeatToggle.checked); };
    repeatToggle.addEventListener('change', syncRepeat);
    syncRepeat();
  }

  const scopeSelect = box.querySelector('select[name="repeat_scope"]');
  const dateInput = box.querySelector('input[name="meeting_date"]');
  if (scopeSelect && dateInput) {
    const syncDateLock = () => { dateInput.disabled = scopeSelect.value !== 'this'; };
    scopeSelect.addEventListener('change', syncDateLock);
    syncDateLock();
  }

  box.querySelector('#mt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    if (!payload.repeat_enabled) {
      delete payload.repeat_freq;
      delete payload.repeat_interval;
      delete payload.repeat_until;
    }
    try {
      if (editing) {
        await api.put(`/attendance/meetings/${editing.meeting_id}`, payload);
        closeModal(); toast(t('att.meeting_updated'), 'success');
        location.hash = `#/attendance/meeting/${editing.meeting_id}`; router();
      } else {
        const { data } = await api.post('/attendance/meetings', payload);
        closeModal();
        if (data.created_count && data.created_count > 1) {
          toast(t('att.repeat_created', { n: data.created_count }), 'success');
        } else {
          toast(t('att.meeting_added'), 'success');
        }
        location.hash = `#/attendance/meeting/${data.meeting_id}`;
      }
    } catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

/* ---- delete a meeting ---- */
async function deleteMeeting(meeting) {
  let scope = 'this';
  if (meeting.series_id) {
    const selected = await selectSeriesScope('delete');
    if (!selected) return;
    scope = selected;
  } else {
    if (!confirm(t('att.del_meeting_confirm', { title: meeting.title }))) return;
  }
  try {
    await api.delete(`/attendance/meetings/${meeting.meeting_id}`, { params: { scope } });
    toast(t('att.meeting_deleted'), 'success');
    location.hash = '#/attendance';
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}

function selectSeriesScope(action) {
  return new Promise((resolve) => {
    const title = action === 'delete' ? t('att.scope_delete_title') : t('att.scope_edit_title');
    const desc = action === 'delete' ? t('att.scope_delete_desc') : t('att.scope_edit_desc');
    const box = h(`<div class="p-6 space-y-3">
      <div>
        <h3 class="text-lg font-bold text-slate-800">${title}</h3>
        <p class="text-sm text-slate-500">${desc}</p>
      </div>
      <div class="space-y-2 text-sm">
        <label class="flex items-center gap-2"><input type="radio" name="series-scope" value="this" checked />${t('att.scope_this')}</label>
        <label class="flex items-center gap-2"><input type="radio" name="series-scope" value="future" />${t('att.scope_future')}</label>
        <label class="flex items-center gap-2"><input type="radio" name="series-scope" value="past" />${t('att.scope_past')}</label>
        <label class="flex items-center gap-2"><input type="radio" name="series-scope" value="all" />${t('att.scope_all')}</label>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" class="flex-1 py-2.5 border rounded-lg text-slate-600" id="scope-cancel">${t('common.cancel')}</button>
        <button type="button" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold" id="scope-apply">${t('att.scope_apply')}</button>
      </div>
    </div>`);
    openModal(box);
    box.querySelector('#scope-cancel').addEventListener('click', () => {
      closeModal();
      resolve(null);
    });
    box.querySelector('#scope-apply').addEventListener('click', () => {
      const selected = box.querySelector('input[name="series-scope"]:checked');
      const value = selected ? selected.value : 'this';
      closeModal();
      resolve(value);
    });
  });
}

async function attendanceMeeting(content, meetingId) {
  content.innerHTML = loadingHtml();
  const { data } = await api.get(`/attendance/meetings/${meetingId}`);
  const m = data.meeting;
  const roster = data.roster || [];
  const notes = data.notes || [];
  window.__absenceReasons = data.absence_reasons || [];
  window.__currentRoster = roster; // Store for member select in note form
  const canEdit = hasPerm('attendance.edit');
  const canManage = hasPerm('meeting.manage');

  content.innerHTML = `
    <div class="mb-4"><a href="#/attendance" class="text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-arrow-left mr-1"></i>${t('att.back_dashboard')}</a></div>
    <div class="card p-5 mb-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-bold text-slate-800">${esc(m.title)}${m.series_id?` <span class="ml-2 px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[11px]">${t('att.repeat_badge')}</span>`:''}</h2>
          <p class="text-sm text-slate-500">${esc(m.group_name)} · ${esc(t('mtype.' + m.meeting_type))} · ${esc(m.meeting_date)}${m.start_time?` ${esc(m.start_time)}`:''}${m.location?` · ${esc(m.location)}`:''}${m.address?` · ${esc(m.address)}`:''}</p>
          ${m.series_id?`<p class="text-xs text-brand-600 mt-1">${esc(buildRepeatInfo(m))}</p>`:''}
        </div>
        ${canManage?`<div class="flex items-center gap-2 shrink-0">
          <button onclick='editMeeting(${JSON.stringify(m)})' title="${t('common.edit')}" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-600"><i class="fas fa-pen text-xs"></i></button>
          <button onclick='deleteMeeting(${JSON.stringify(m)})' title="${t('common.delete')}" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button>
        </div>`:''}
      </div>
    </div>
    <div class="card p-5 mb-4">
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
    </div>
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-slate-700">${t('att.notes_title')}</h3>
        ${canEdit?`<button onclick="addMeetingNote(${meetingId})" class="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 font-medium"><i class="fas fa-plus mr-1"></i>${t('att.add_note')}</button>`:''}
      </div>
      <div class="space-y-3">
        ${notes.length ? notes.map((n)=>meetingNoteRow(n, canEdit, meetingId)).join('') : `<div class="text-sm text-slate-400 py-4 text-center">${t('att.no_notes')}</div>`}
      </div>
    </div>`;
}

function rosterRow(r, canEdit) {
  const name = nativeName(r);
  const cur = r.status || 'present';
  const statuses = ['present','absent'];
  const reasonOptions = ['<option value="">-</option>']
    .concat((window.__absenceReasons || []).map((item)=>`<option value="${item.reason_id}" ${String(item.reason_id)===String(r.absence_reason_id||'')?'selected':''}>${esc(localizeMetaName(item))}</option>`))
    .join('');
  const reasonLabelText = r.absence_reason_id ? reasonLabel(r.absence_reason_id) : '';
  return `<div class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100" data-member="${r.member_id}" data-reason="${r.absence_reason_id || ''}">
    ${avatar(r.photo_url, r.first_name, r.last_name, 'w-9 h-9')}
    <div class="flex-1 min-w-0">
      <button onclick="showMemberPopup(${r.member_id})" class="text-sm font-medium text-slate-800 hover:text-brand-600 truncate block text-left w-full">${esc(name)}</button>
      ${r.title?`<div class="text-xs text-slate-400">${esc(r.title)}</div>`:''}
      ${!canEdit && cur === 'absent' && reasonLabelText ? `<div class="text-xs text-slate-400 mt-1">${t('att.absence_reason')}: ${esc(reasonLabelText)}</div>`:''}
    </div>
    ${canEdit ? `<div class="flex flex-col items-end gap-1">
      <div class="flex gap-1 flex-wrap justify-end">${statuses.map((s)=>`
        <button data-status="${s}" onclick="setStatus(${r.member_id},'${s}')" class="att-btn text-[11px] px-2 py-1 rounded-md ${s===cur?STATUS_COLOR[s]+' text-white':'bg-slate-100 text-slate-500'}">${statusLabel(s)}</button>`).join('')}</div>
      <select class="att-reason text-[11px] px-2 py-1 rounded-md border border-slate-200 ${cur==='absent'?'':'hidden'}" onchange="setReason(${r.member_id}, this.value)">
        ${reasonOptions}
      </select>
    </div>`
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
  const reasonSelect = row.querySelector('.att-reason');
  if (reasonSelect) {
    if (status === 'absent') {
      reasonSelect.classList.remove('hidden');
    } else {
      reasonSelect.classList.add('hidden');
      reasonSelect.value = '';
      row.dataset.reason = '';
    }
  }
}
function setReason(memberId, reasonId) {
  const row = document.querySelector(`#roster [data-member="${memberId}"]`);
  row.dataset.reason = reasonId || '';
}
function bulkSet(status) {
  document.querySelectorAll('#roster [data-member]').forEach((row) => setStatus(parseInt(row.dataset.member,10), status));
}
async function saveAttendance(meetingId) {
  const records = [...document.querySelectorAll('#roster [data-member]')].map((row) => ({
    member_id: parseInt(row.dataset.member,10),
    status: row.dataset.status || 'present',
    absence_reason_id: row.dataset.reason ? parseInt(row.dataset.reason, 10) : null,
  }));
  try {
    await api.post(`/attendance/meetings/${meetingId}/record`, { records });
    toast(t('att.saved_count', { n: records.length }), 'success');
  } catch (err) { toast(err.response?.data?.error || t('att.save_failed'), 'error'); }
}

function meetingNoteRow(note, canEdit, meetingId) {
  const typeLabel = t('att.note_type_' + note.note_type) || note.note_type;
  const nJson = JSON.stringify(note).replace(/'/g, '&#39;');
  // type badge color
  const typeBadgeColor = { prayer:'bg-purple-50 text-purple-600', fellowship:'bg-blue-50 text-blue-600', news:'bg-blue-50 text-blue-600', testimony:'bg-amber-50 text-amber-700', other:'bg-slate-100 text-slate-500' };
  const badgeClass = typeBadgeColor[note.note_type] || typeBadgeColor.other;
  // Render content: if HTML tags detected, render as HTML; else as plain text
  const isHtml = /<[a-z][\s\S]*>/i.test(note.content || '');
  const contentHtml = isHtml ? (note.content || '') : `<p class="whitespace-pre-line">${esc(note.content || '')}</p>`;
  // Member name for prayer/testimony
  let memberHtml = '';
  if ((note.note_type === 'prayer' || note.note_type === 'testimony') && note.member_id) {
    const memberName = note.member_korean_name || [note.member_first_name, note.member_last_name].filter(Boolean).join(' ');
    memberHtml = `<button onclick="showMemberPopup(${note.member_id})" class="text-xs text-brand-600 hover:underline font-medium"><i class="fas fa-user mr-1"></i>${esc(memberName)}</button>`;
  }
  return `<div class="p-4 border border-slate-100 rounded-xl bg-white">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="badge ${badgeClass} text-xs px-2 py-0.5">${esc(typeLabel)}</span>
        ${memberHtml}
        <span class="text-xs text-slate-400">${esc((note.created_at||'').slice(0,10))}</span>
      </div>
      ${canEdit?`<div class="flex items-center gap-2">
        <button onclick='editMeetingNote(${meetingId}, ${nJson})' class="text-slate-400 hover:text-brand-600" title="${t('common.edit')}"><i class="fas fa-pen text-xs"></i></button>
        <button onclick='deleteMeetingNote(${meetingId}, ${note.note_id})' class="text-slate-400 hover:text-red-500" title="${t('common.delete')}"><i class="fas fa-trash text-xs"></i></button>
      </div>`:''}
    </div>
    <div class="text-sm text-slate-700 prose prose-sm max-w-none">${contentHtml}</div>
  </div>`;
}

function addMeetingNote(meetingId) {
  openMeetingNoteForm(meetingId, null);
}

function editMeetingNote(meetingId, note) {
  openMeetingNoteForm(meetingId, note);
}

function openMeetingNoteForm(meetingId, note) {
  const n = note || {};
  const typeOptions = ['prayer','fellowship','testimony','other']
    .map((nt)=>`<option value="${nt}" ${n.note_type===nt?'selected':''}>${t('att.note_type_' + nt)}</option>`)
    .join('');
  // Get roster members for member selection dropdown
  const rosterMembers = window.__currentRoster || [];
  const memberOptions = ['<option value="">' + esc(t('att.note_member_select')) + '</option>']
    .concat(rosterMembers.map((r) => {
      const mName = r.korean_name || [r.first_name, r.last_name].filter(Boolean).join(' ');
      const selected = String(r.member_id) === String(n.member_id || '') ? 'selected' : '';
      return `<option value="${r.member_id}" ${selected}>${esc(mName)}</option>`;
    }))
    .join('');
  const box = h(`<div class="p-6 max-h-[85vh] overflow-y-auto">
    <h3 class="text-lg font-bold mb-4">${note?t('att.edit_note'):t('att.add_note')}</h3>
    <form id="note-form" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.note_type')}</label>
        <select id="note-type-sel" name="note_type" class="w-full px-3 py-2.5 border rounded-lg">${typeOptions}</select>
      </div>
      <div id="note-member-row" class="hidden">
        <label class="block text-xs font-semibold text-slate-600 mb-1"><i class="fas fa-user mr-1 text-brand-500"></i>${t('att.note_member')}</label>
        <select name="member_id" class="w-full px-3 py-2.5 border rounded-lg">${memberOptions}</select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.note_content')}</label>
        <div id="note-editor-toolbar" class="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-t-lg text-slate-600">
          <button type="button" class="note-tool px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold" data-cmd="bold" title="Bold"><b>B</b></button>
          <button type="button" class="note-tool px-2 py-1 rounded hover:bg-slate-200 text-xs italic" data-cmd="italic" title="Italic"><i>I</i></button>
          <button type="button" class="note-tool px-2 py-1 rounded hover:bg-slate-200 text-xs underline" data-cmd="underline" title="Underline"><u>U</u></button>
          <span class="border-l border-slate-300 mx-1"></span>
          <button type="button" class="note-tool px-2 py-1 rounded hover:bg-slate-200 text-xs" data-cmd="insertUnorderedList" title="Bullet list">&#8226; List</button>
          <button type="button" class="note-tool px-2 py-1 rounded hover:bg-slate-200 text-xs" data-cmd="insertOrderedList" title="Numbered list">1. List</button>
          <span class="border-l border-slate-300 mx-1"></span>
          <select id="note-heading-sel" class="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white" title="${t('att.editor_heading')}">
            <option value="p">${t('att.editor_normal')}</option>
            <option value="h3">${t('att.editor_heading3')}</option>
            <option value="h4">${t('att.editor_heading4')}</option>
          </select>
        </div>
        <div id="note-editor"
          contenteditable="true"
          class="min-h-[140px] max-h-[340px] overflow-y-auto w-full px-3 py-2.5 border border-t-0 border-slate-200 rounded-b-lg focus:outline-none focus:border-brand-400 text-sm text-slate-700"
          placeholder="${esc(t('att.note_content_ph'))}"></div>
        <input type="hidden" name="content" />
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button>
        <button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button>
      </div>
    </form>
  </div>`);
  openModal(box, { size:'max-w-xl' });

  // Show/hide member select based on type
  const noteTypeSel = box.querySelector('#note-type-sel');
  const memberRow = box.querySelector('#note-member-row');
  const syncMemberRow = () => {
    const nt = noteTypeSel.value;
    if (nt === 'prayer' || nt === 'testimony') {
      memberRow.classList.remove('hidden');
    } else {
      memberRow.classList.add('hidden');
    }
  };
  noteTypeSel.addEventListener('change', syncMemberRow);
  syncMemberRow();

  const editor = box.querySelector('#note-editor');
  const contentInput = box.querySelector('input[name="content"]');

  // Set initial content
  if (n.content) {
    if (/<[a-z][\s\S]*>/i.test(n.content)) {
      editor.innerHTML = n.content;
    } else {
      editor.innerHTML = n.content.split('\n').map((line) => `<p>${esc(line) || '<br>'}</p>`).join('');
    }
  }

  // Toolbar buttons
  box.querySelectorAll('.note-tool').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, null);
      editor.focus();
    });
  });

  // Heading select
  const headingSel = box.querySelector('#note-heading-sel');
  if (headingSel) {
    headingSel.addEventListener('change', (e) => {
      e.preventDefault();
      const tag = e.target.value;
      if (tag === 'p') {
        document.execCommand('formatBlock', false, 'p');
      } else {
        document.execCommand('formatBlock', false, tag);
      }
      editor.focus();
      setTimeout(() => { headingSel.value = 'p'; }, 200);
    });
  }

  box.querySelector('#note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const htmlContent = editor.innerHTML.trim();
    if (!htmlContent || htmlContent === '<br>') {
      toast(t('att.note_content_ph'), 'error');
      return;
    }
    contentInput.value = htmlContent;
    const fd = new FormData(e.target);
    const noteType = fd.get('note_type');
    const memberId = (noteType === 'prayer' || noteType === 'testimony') ? (fd.get('member_id') || null) : null;
    const payload = { note_type: noteType, content: fd.get('content'), member_id: memberId ? parseInt(memberId, 10) : null };
    try {
      if (note) {
        await api.put(`/attendance/meetings/${meetingId}/notes/${n.note_id}`, payload);
      } else {
        await api.post(`/attendance/meetings/${meetingId}/notes`, payload);
      }
      closeModal();
      toast(t('common.saved'), 'success');
      router();
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });
}

/* ---- Member popup from roster ---- */
async function showMemberPopup(memberId) {
  const box = h(`<div class="p-5 max-h-[92vh] overflow-y-auto" id="member-popup-inner">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-bold text-slate-800"><i class="fas fa-user-circle mr-2 text-brand-500"></i>${t('member.popup_title')}</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100"><i class="fas fa-times"></i></button>
    </div>
    <div id="member-popup-content">${loadingHtml()}</div>
  </div>`);
  openModal(box, { size: 'max-w-2xl' });
  try {
    const { data } = await api.get(`/members/${memberId}`);
    const m = data.member;
    const addr = data.address;
    const name = nativeName(m);
    const enName = `${m.first_name || ''} ${m.last_name || ''}`.trim();
    const koLast  = (m.korean_last_name  || '').trim();
    const koFirst = (m.korean_first_name || '').trim();
    const koName  = (koLast + koFirst).trim() || (m.korean_name || '').trim();
    const showSub = koName && enName && koName !== enName;

    // 나이 계산
    let ageStr = '';
    if (m.birth_date) {
      const birth = new Date(m.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
      ageStr = `${age}${t('member.age_years')}`;
    }

    // 연락처
    const contactsHtml = data.contacts.map((ct) => {
      if (ct.contact_type === 'email') {
        return `<a href="mailto:${esc(ct.value)}" class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100">
          <i class="fas fa-envelope w-4 text-brand-600 text-xs"></i>
          <div><div class="text-xs text-slate-400">${t('member.contact_email')}</div><div class="text-sm text-slate-700">${esc(ct.value)}</div></div>
          ${ct.is_primary ? `<span class="ml-auto text-xs text-brand-500">${t('member.primary')}</span>` : ''}
        </a>`;
      }
      const labelMap = { mobile: t('member.contact_mobile'), home: t('member.contact_home'), office: t('member.contact_office') };
      return `<a href="tel:${esc(ct.value.replace(/[^0-9+]/g, ''))}" class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-emerald-50">
        <i class="fas fa-phone w-4 text-emerald-600 text-xs"></i>
        <div><div class="text-xs text-slate-400">${labelMap[ct.contact_type] || ct.contact_type}</div><div class="text-sm text-slate-700">${esc(ct.value)}</div></div>
        ${ct.is_primary ? `<span class="ml-auto text-xs text-emerald-600">${t('member.primary')}</span>` : ''}
      </a>`;
    }).join('') || `<p class="text-xs text-slate-400 py-1">${t('member.no_contacts')}</p>`;

    // 주소
    const fullAddr = [addr.line1, addr.line2, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
    const mapsUrl = fullAddr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}` : null;

    // 소속/직분
    const assignHtml = data.assignments.length
      ? data.assignments.map((a) => `
        <div class="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
          <i class="fas fa-sitemap text-slate-400 w-4 text-xs mt-0.5"></i>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-slate-700 font-medium">${esc(a.group_name)}</div>
            <div class="text-xs text-slate-400">${esc(a.position_name)}${a.is_primary ? ' · <span class="text-brand-600">' + t('member.primary_affiliation') + '</span>' : ''}</div>
          </div>
        </div>`).join('')
      : `<p class="text-xs text-slate-400 py-1">${t('member.no_assignments')}</p>`;

    // 가족 구성원
    const relLabelMap = {
      spouse: t('member.relation_spouse'), parent: t('member.relation_parent'),
      child: t('member.relation_child'), sibling: t('member.relation_sibling'), other: t('member.relation_other'),
    };
    const relsHtml = data.relationships.length
      ? data.relationships.map((r) => {
          const rn = nativeName(r);
          return `<div class="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
            ${avatar(r.photo_url, r.first_name, r.last_name, 'w-8 h-8 text-sm')}
            <div class="flex-1 min-w-0">
              <div class="text-sm text-slate-700 font-medium">${esc(rn)}</div>
              <div class="text-xs text-slate-400">${esc(relLabelMap[r.relation_type] || r.relation_type)}${r.title ? ' · ' + esc(r.title) : ''}</div>
            </div>
          </div>`;
        }).join('')
      : `<p class="text-xs text-slate-400 py-1">${t('member.no_relations')}</p>`;

    // 언어
    const profMap = { native: t('member.native'), fluent: t('member.fluent'), conversational: t('member.conversational'), basic: t('member.basic') };
    const langsHtml = data.languages.length
      ? data.languages.map((l) => `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs border border-sky-100">
          <i class="fas fa-language text-xs"></i>
          ${esc(l.name_en || l.code)}${l.proficiency ? ' · ' + (profMap[l.proficiency] || l.proficiency) : ''}
        </span>`).join('')
      : `<p class="text-xs text-slate-400 py-1">${t('member.no_languages')}</p>`;

    // 기본 정보 row
    const infoRows = [
      m.birth_date && `<div class="flex items-center gap-2 text-sm">
        <i class="fas fa-cake-candles text-slate-400 w-4 text-xs"></i>
        <span class="text-slate-600">${esc(m.birth_date)}</span>
        ${ageStr ? `<span class="text-xs text-slate-400">(${ageStr})</span>` : ''}
        ${m.gender ? `<span class="text-xs text-slate-400">· ${t('gender.' + m.gender)}</span>` : ''}
      </div>`,
      m.member_type && `<div class="flex items-center gap-2 text-sm">
        <i class="fas fa-id-card text-slate-400 w-4 text-xs"></i>
        <span class="text-slate-600">${esc(metaLabel('memberTypes', m.member_type) || m.member_type)}</span>
      </div>`,
      m.employment_type && `<div class="flex items-center gap-2 text-sm">
        <i class="fas fa-briefcase text-slate-400 w-4 text-xs"></i>
        <span class="text-slate-600">${esc(metaLabel('employmentTypes', m.employment_type) || m.employment_type)}</span>
      </div>`,
      m.salvation_date && `<div class="flex items-center gap-2 text-sm">
        <i class="fas fa-cross text-slate-400 w-4 text-xs"></i>
        <span class="text-xs text-slate-400">${t('member.salvation_date')}</span>
        <span class="text-slate-600">${esc(m.salvation_date)}</span>
      </div>`,
      m.household_name && `<div class="flex items-center gap-2 text-sm">
        <i class="fas fa-house text-slate-400 w-4 text-xs"></i>
        <span class="text-xs text-slate-400">${t('member.household_label')}</span>
        <span class="text-slate-600">${esc(m.household_name)}</span>
        ${m.household_role ? `<span class="text-xs text-slate-400">(${esc(m.household_role)})</span>` : ''}
      </div>`,
      m.note && `<div class="flex items-start gap-2 text-sm">
        <i class="fas fa-note-sticky text-slate-400 w-4 text-xs mt-0.5"></i>
        <span class="text-slate-600 text-xs">${esc(m.note)}</span>
      </div>`,
    ].filter(Boolean).join('');

    const popup = box.querySelector('#member-popup-content');
    popup.innerHTML = `
      <!-- 프로필 헤더 -->
      <div class="flex items-start gap-4 pb-4 border-b border-slate-100">
        <div class="shrink-0">${avatar(m.photo_url, m.first_name, m.last_name, 'w-16 h-16 text-xl')}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="text-xl font-bold text-slate-800">${esc(name)}</h4>
            ${m.title ? `<span class="badge bg-brand-50 text-brand-700">${esc(m.title)}</span>` : ''}
            ${statusBadge(m.status)}
          </div>
          ${showSub ? `<div class="text-sm text-slate-400 mt-0.5">${esc(enName)}</div>` : ''}
          ${m.preferred_name ? `<div class="text-xs text-slate-400 mt-0.5"><i class="fas fa-quote-left text-xs mr-1"></i>${esc(m.preferred_name)}</div>` : ''}
          ${infoRows ? `<div class="mt-2 space-y-1">${infoRows}</div>` : ''}
        </div>
      </div>

      <!-- 연락처 & 주소 -->
      <div class="mt-4">
        <div class="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
          <i class="fas fa-address-book text-brand-400"></i>${t('member.contacts_address')}
        </div>
        <div class="space-y-1">${contactsHtml}</div>
        ${fullAddr ? `<a href="${mapsUrl}" target="_blank" class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-blue-50 mt-1">
          <i class="fas fa-location-dot w-4 text-blue-600 text-xs"></i>
          <div><div class="text-xs text-slate-400">${t('member.address')}</div><div class="text-sm text-slate-700">${esc(fullAddr)}</div></div>
          <i class="fas fa-external-link-alt text-slate-300 text-xs ml-auto"></i>
        </a>` : ''}
      </div>

      <!-- 소속 / 직분 -->
      <div class="mt-4">
        <div class="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
          <i class="fas fa-sitemap text-brand-400"></i>${t('member.affiliation_section')}
        </div>
        <div class="space-y-1">${assignHtml}</div>
      </div>

      <!-- 가족 구성원 -->
      <div class="mt-4">
        <div class="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
          <i class="fas fa-people-group text-brand-400"></i>${t('member.family_section')}
        </div>
        <div class="space-y-1">${relsHtml}</div>
      </div>

      <!-- 언어 -->
      ${data.languages.length ? `
      <div class="mt-4">
        <div class="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
          <i class="fas fa-language text-brand-400"></i>${t('member.language_section')}
        </div>
        <div class="flex flex-wrap gap-1">${langsHtml}</div>
      </div>` : ''}

      <!-- 성도 상세 페이지 이동 버튼 -->
      <div class="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <a href="#/members/${memberId}" onclick="closeModal()" class="flex-1 py-2.5 text-center text-sm text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 font-medium">
          <i class="fas fa-external-link-alt mr-1.5"></i>${t('member.open_detail')}
        </a>
      </div>`;
  } catch (err) {
    const popup = box.querySelector('#member-popup-content');
    if (popup) popup.innerHTML = `<div class="text-sm text-red-500 p-4">${t('common.error_occurred')} ${err.message || ''}</div>`;
  }
}

async function deleteMeetingNote(meetingId, noteId) {
  if (!confirm(t('att.note_delete_confirm'))) return;
  try {
    await api.delete(`/attendance/meetings/${meetingId}/notes/${noteId}`);
    toast(t('common.deleted'), 'success');
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}
