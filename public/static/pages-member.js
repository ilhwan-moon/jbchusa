/* ============================================================
 * Member detail page (photo upload, contacts as tel:, address -> google maps, family)
 * ============================================================ */
Pages.memberDetail = async function (content, memberId) {
  content.innerHTML = loadingHtml();
  const { data } = await api.get(`/members/${memberId}`);
  const m = data.member;
  const addr = data.address;
  const name = m.korean_name || `${m.first_name} ${m.last_name}`;
  const engName = `${m.first_name} ${m.last_name}`;
  const canEdit = hasPerm('member.edit');

  const fullAddr = [addr.line1, addr.line2, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
  const mapsUrl = fullAddr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}` : null;

  const contactsHtml = data.contacts.map((ct) => {
    if (ct.contact_type === 'email') {
      return `<a href="mailto:${esc(ct.value)}" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100">
        <i class="fas fa-envelope w-5 text-brand-600"></i><div><div class="text-xs text-slate-400">이메일</div><div class="text-sm font-medium text-slate-700">${esc(ct.value)}</div></div></a>`;
    }
    const labelMap = { mobile:'휴대전화', home:'집전화', office:'직장' };
    return `<a href="tel:${esc(ct.value.replace(/[^0-9+]/g,''))}" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50">
      <i class="fas fa-phone w-5 text-emerald-600"></i><div><div class="text-xs text-slate-400">${labelMap[ct.contact_type]||ct.contact_type}${ct.is_primary?' · 대표':''}</div><div class="text-sm font-medium text-slate-700">${esc(ct.value)}</div></div>
      <i class="fas fa-arrow-up-right-from-square text-slate-300 text-xs ml-auto"></i></a>`;
  }).join('') || '<div class="text-sm text-slate-400 p-3">등록된 연락처가 없습니다.</div>';

  const assignHtml = data.assignments.map((a) => {
    const cm = CATEGORY_META[a.category_code] || {};
    return `<div class="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
      <i class="fas ${cm.icon||'fa-folder'} ${cm.color||''} w-5"></i>
      <div class="flex-1"><div class="text-sm font-medium text-slate-700">${esc(a.group_name)}</div><div class="text-xs text-slate-400">${esc(a.category_name)} · ${esc(a.position_name)}${a.sub_role?` (${esc(a.sub_role)})`:''}</div></div>
      ${a.is_primary?'<span class="badge bg-brand-50 text-brand-700">주소속</span>':''}
      ${canEdit?`<button onclick="deleteAssignment(${a.assignment_id},${m.member_id})" class="text-slate-300 hover:text-red-500"><i class="fas fa-times"></i></button>`:''}
    </div>`;
  }).join('') || '<div class="text-sm text-slate-400">소속 정보가 없습니다.</div>';

  const famHtml = data.relationships.map((rel) => {
    const rn = rel.korean_name || `${rel.first_name} ${rel.last_name}`;
    const relLabel = { spouse:'배우자', parent:'부모', child:'자녀', sibling:'형제자매', grandparent:'조부모', grandchild:'손주', guardian:'보호자', other:'기타' }[rel.relation_type] || rel.relation_type;
    return `<div class="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
      <a href="#/members/${rel.related_id}" class="flex items-center gap-3 flex-1 min-w-0">
        ${avatar(rel.photo_url, rel.first_name, rel.last_name, 'w-9 h-9')}
        <div class="min-w-0"><div class="text-sm font-medium text-slate-700 truncate">${esc(rn)}</div><div class="text-xs text-slate-400">${relLabel}${rel.title?` · ${esc(rel.title)}`:''}</div></div>
      </a>
      ${canEdit?`<button onclick="deleteRelationship(${rel.relationship_id},${m.member_id})" class="text-slate-300 hover:text-red-500"><i class="fas fa-times"></i></button>`:''}
    </div>`;
  }).join('') || '<div class="text-sm text-slate-400">등록된 가족이 없습니다.</div>';

  const langHtml = data.languages.map((l) => `<span class="badge bg-slate-100 text-slate-600">${esc(l.name_native||l.name_en)}${l.is_primary?' ★':''}</span>`).join(' ');

  content.innerHTML = `
    <div class="mb-4"><a href="javascript:history.back()" class="text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-arrow-left mr-1"></i>뒤로</a></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Profile -->
      <div class="card p-6 text-center">
        <div class="relative inline-block">
          <div id="photo-holder">${avatar(m.photo_url, m.first_name, m.last_name, 'w-28 h-28 mx-auto text-3xl')}</div>
          ${canEdit?`<button onclick="document.getElementById('photo-input').click()" class="absolute bottom-0 right-0 w-8 h-8 bg-brand-600 text-white rounded-full flex items-center justify-center shadow hover:bg-brand-700"><i class="fas fa-camera text-xs"></i></button>
          <input type="file" id="photo-input" accept="image/*" class="hidden" onchange="uploadPhoto(${m.member_id}, this)" />`:''}
        </div>
        <h2 class="text-xl font-bold text-slate-800 mt-3">${esc(name)}</h2>
        <p class="text-sm text-slate-500">${esc(engName)}${m.preferred_name && m.preferred_name!==m.first_name?` (${esc(m.preferred_name)})`:''}</p>
        <div class="flex items-center justify-center gap-2 mt-2">
          ${m.title?`<span class="badge bg-brand-50 text-brand-700">${esc(m.title)}</span>`:''}
          ${statusBadge(m.status)}
          <span class="badge bg-slate-100 text-slate-600">${esc(m.member_type)}</span>
        </div>
        ${langHtml?`<div class="mt-3">${langHtml}</div>`:''}
        ${canEdit?`<button onclick="editMember(${m.member_id})" class="mt-4 w-full py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><i class="fas fa-pen mr-1"></i>정보 수정</button>`:''}
      </div>

      <!-- Details -->
      <div class="lg:col-span-2 space-y-4">
        <div class="card p-5">
          <h3 class="font-bold text-slate-700 mb-3"><i class="fas fa-address-card text-brand-500 mr-2"></i>연락처 & 주소</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${contactsHtml}</div>
          <div class="mt-2">
            ${fullAddr ? `<a href="${mapsUrl}" target="_blank" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50">
              <i class="fas fa-location-dot w-5 text-blue-600"></i>
              <div class="flex-1"><div class="text-xs text-slate-400">주소 ${m.use_own_address?'(개인)':'(세대)'}</div><div class="text-sm font-medium text-slate-700">${esc(fullAddr)}</div></div>
              <i class="fas fa-map-location-dot text-slate-300 ml-auto"></i></a>`
              : '<div class="text-sm text-slate-400 p-3">등록된 주소가 없습니다.</div>'}
          </div>
          ${m.birth_date?`<div class="text-sm text-slate-500 mt-3 px-1"><i class="fas fa-cake-candles mr-2 text-pink-400"></i>${esc(m.birth_date)}${m.gender?` · ${m.gender==='M'?'남':'여'}`:''}</div>`:''}
        </div>

        <div class="card p-5">
          <h3 class="font-bold text-slate-700 mb-3"><i class="fas fa-sitemap text-brand-500 mr-2"></i>소속 / 직분</h3>
          <div class="space-y-2">${assignHtml}</div>
          ${canEdit?`<button onclick="addAssignment(${m.member_id})" class="mt-3 text-sm text-brand-600 font-medium"><i class="fas fa-plus mr-1"></i>소속 추가</button>`:''}
        </div>

        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-slate-700"><i class="fas fa-people-roof text-brand-500 mr-2"></i>가족 구성원</h3>
            ${canEdit?`<button onclick="addRelationship(${m.member_id})" class="text-sm text-brand-600 font-medium"><i class="fas fa-user-plus mr-1"></i>가족 추가</button>`:''}
          </div>
          <div class="space-y-2">${famHtml}</div>
          ${m.household_id?`<a href="#/households/${m.household_id}" class="mt-3 inline-block text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-house-user mr-1"></i>세대 보기</a>`:''}
        </div>

        ${m.note?`<div class="card p-5"><h3 class="font-bold text-slate-700 mb-2"><i class="fas fa-note-sticky text-brand-500 mr-2"></i>메모</h3><p class="text-sm text-slate-600 whitespace-pre-line">${esc(m.note)}</p></div>`:''}
      </div>
    </div>`;
};

/* ---- photo upload (resize client-side, store as data URL) ---- */
async function uploadPhoto(memberId, input) {
  const file = input.files[0]; if (!file) return;
  toast('이미지 처리 중...', 'info');
  try {
    const dataUrl = await resizeImage(file, 400, 400, 0.82);
    await api.put(`/members/${memberId}/photo`, { photo_url: dataUrl });
    el('photo-holder').innerHTML = `<img src="${dataUrl}" class="w-28 h-28 mx-auto rounded-full object-cover border border-slate-200" />`;
    toast('사진이 업데이트되었습니다.', 'success');
  } catch (e) {
    toast(e.response?.data?.error || '업로드 실패', 'error');
  }
}

function resizeImage(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.round(width * ratio); height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---- family relationship ---- */
async function addRelationship(memberId) {
  const { data } = await api.get('/members', { params: {} });
  const others = data.members.filter((x) => x.member_id !== memberId);
  const opts = others.map((x) => `<option value="${x.member_id}">${esc(x.korean_name || x.first_name+' '+x.last_name)}</option>`).join('');
  const relOpts = [['spouse','배우자','spouse'],['parent','부모','child'],['child','자녀','parent'],['sibling','형제자매','sibling'],['grandparent','조부모','grandchild'],['grandchild','손주','grandparent'],['guardian','보호자','other'],['other','기타','other']]
    .map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
  const box = h(`<div class="p-6">
    <h3 class="text-lg font-bold mb-4">가족 구성원 추가</h3>
    <form id="rel-form" class="space-y-3">
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">대상 교인</label><select name="related_id" class="w-full px-3 py-2.5 border rounded-lg">${opts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">관계 (이 교인 기준)</label><select name="relation_type" class="w-full px-3 py-2.5 border rounded-lg">${relOpts}</select></div>
      <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="reciprocal" checked /> 반대 관계도 자동 등록</label>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">추가</button></div>
    </form></div>`);
  openModal(box);
  const recipMap = { spouse:'spouse', parent:'child', child:'parent', sibling:'sibling', grandparent:'grandchild', grandchild:'grandparent', guardian:'other', other:'other' };
  box.querySelector('#rel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rt = fd.get('relation_type');
    try {
      await api.post(`/members/${memberId}/relationships`, {
        related_id: parseInt(fd.get('related_id'),10), relation_type: rt,
        reciprocal_type: fd.get('reciprocal') ? recipMap[rt] : null,
      });
      closeModal(); toast('가족이 추가되었습니다.', 'success'); router();
    } catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}

async function deleteRelationship(relId, memberId) {
  if (!confirm('이 가족 관계를 삭제하시겠습니까?')) return;
  await api.delete(`/members/relationships/${relId}`);
  toast('삭제되었습니다.', 'success'); router();
}

/* ---- assignments ---- */
async function addAssignment(memberId) {
  const [{ data: gd }, { data: pd }] = await Promise.all([api.get('/orgs/groups'), api.get('/admin/positions')]);
  const gOpts = gd.groups.map((g) => `<option value="${g.group_id}">[${CATEGORY_META[g.category_code]?.label||g.category_code}] ${esc(g.name)}</option>`).join('');
  const pOpts = pd.positions.map((p) => `<option value="${p.position_id}">${esc(p.name)} (${esc(p.position_type)})</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">소속 추가</h3>
    <form id="asg-form" class="space-y-3">
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">조직</label><select name="group_id" class="w-full px-3 py-2.5 border rounded-lg">${gOpts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">직분</label><select name="position_id" class="w-full px-3 py-2.5 border rounded-lg">${pOpts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">세부역할 (선택)</label><input name="sub_role" class="w-full px-3 py-2.5 border rounded-lg" placeholder="(정)/(부)/(형제) 등" /></div>
      <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="is_primary" /> 주 소속으로 설정</label>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">추가</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#asg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post(`/members/${memberId}/assignments`, {
        group_id: parseInt(fd.get('group_id'),10), position_id: parseInt(fd.get('position_id'),10),
        sub_role: fd.get('sub_role') || null, is_primary: fd.get('is_primary') ? 1 : 0,
      });
      closeModal(); toast('소속이 추가되었습니다.', 'success'); router();
    } catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}
async function deleteAssignment(asgId, memberId) {
  if (!confirm('이 소속을 삭제하시겠습니까?')) return;
  await api.delete(`/members/assignments/${asgId}`);
  toast('삭제되었습니다.', 'success'); router();
}

/* ---- edit/create member form ---- */
async function editMember(memberId) {
  let m = {};
  if (memberId) { const { data } = await api.get(`/members/${memberId}`); m = data.member; }
  const sel = (val, opts) => opts.map((o) => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('');
  const box = h(`<div class="p-6 max-h-[80vh] overflow-y-auto">
    <h3 class="text-lg font-bold mb-4">${memberId?'교인 정보 수정':'새 교인 등록'}</h3>
    <form id="m-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">First Name *</label><input name="first_name" required value="${esc(m.first_name||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Last Name *</label><input name="last_name" required value="${esc(m.last_name||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">한국어 이름</label><input name="korean_name" value="${esc(m.korean_name||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">직분/호칭</label><input name="title" value="${esc(m.title||'')}" class="w-full px-3 py-2 border rounded-lg" placeholder="집사/장로/권사" /></div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">성별</label><select name="gender" class="w-full px-3 py-2 border rounded-lg"><option value="">-</option><option value="M" ${m.gender==='M'?'selected':''}>남</option><option value="F" ${m.gender==='F'?'selected':''}>여</option></select></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">생년월일</label><input type="date" name="birth_date" value="${esc(m.birth_date||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">상태</label><select name="status" class="w-full px-3 py-2 border rounded-lg">${sel(m.status||'활동',['활동','휴면','이전','사망'])}</select></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">교인구분</label><select name="member_type" class="w-full px-3 py-2 border rounded-lg">${sel(m.member_type||'교인',['교인','새신자','목회자','직원','학생'])}</select></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">근무형태</label><select name="employment_type" class="w-full px-3 py-2 border rounded-lg">${sel(m.employment_type||'봉사자',['봉사자','상근직원','목회자'])}</select></div>
      </div>
      ${!memberId?`<div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">휴대전화</label><input name="mobile" class="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">이메일</label><input name="email" class="w-full px-3 py-2 border rounded-lg" /></div>
      </div>`:''}
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">메모</label><textarea name="note" rows="2" class="w-full px-3 py-2 border rounded-lg">${esc(m.note||'')}</textarea></div>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">저장</button></div>
    </form></div>`);
  openModal(box, { size:'max-w-xl' });
  box.querySelector('#m-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try {
      if (memberId) { await api.put(`/members/${memberId}`, payload); }
      else { const { data } = await api.post('/members', payload); memberId = data.member_id; }
      closeModal(); toast('저장되었습니다.', 'success');
      location.hash = `#/members/${memberId}`; router();
    } catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}
