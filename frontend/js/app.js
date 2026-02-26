/**
 * app.js - KCR Overtime Tracker 조합원 모바일 웹 SPA
 * Tailwind CSS + Vanilla JS
 */

/* ============================
   유틸리티
   ============================ */

const U = {
  $(id) { return document.getElementById(id); },

  fmtOT(min) {
    if (!min || min <= 0) return '-';
    var h = Math.floor(min / 60), m = min % 60;
    if (h > 0 && m > 0) return h + '시간 ' + m + '분';
    return h > 0 ? h + '시간' : m + '분';
  },

  todayStr() {
    var n = new Date();
    var days = ['일','월','화','수','목','금','토'];
    var y = n.getFullYear();
    var m = String(n.getMonth()+1).padStart(2,'0');
    var d = String(n.getDate()).padStart(2,'0');
    return y + '.' + m + '.' + d + ' (' + days[n.getDay()] + ')';
  },

  showLoading(msg) {
    var el = U.$('loading');
    if (el) { el.querySelector('span').textContent = msg || '로딩 중...'; el.classList.remove('hidden'); }
  },
  hideLoading() { var el = U.$('loading'); if (el) el.classList.add('hidden'); },

  toast(msg, type) {
    type = type || 'info';
    var colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-blue-600' };
    var t = document.createElement('div');
    t.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-[9999] transition-all duration-300 opacity-0 -translate-y-2 ' + (colors[type] || colors.info);
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.classList.remove('opacity-0','-translate-y-2'); });
    setTimeout(function(){
      t.classList.add('opacity-0','-translate-y-2');
      setTimeout(function(){ t.remove(); }, 300);
    }, 2500);
  },

  confirm(msg) {
    return new Promise(function(resolve) {
      var bg = document.createElement('div');
      bg.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9000] p-5';
      bg.innerHTML =
        '<div class="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl">' +
          '<p class="text-center text-base leading-relaxed mb-5 whitespace-pre-line">' + msg + '</p>' +
          '<div class="flex gap-3">' +
            '<button id="_mc" class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold">취소</button>' +
            '<button id="_mo" class="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold">확인</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(bg);
      U.$('_mc').onclick = function(){ bg.remove(); resolve(false); };
      U.$('_mo').onclick = function(){ bg.remove(); resolve(true); };
    });
  }
};

/* ============================
   App 클래스
   ============================ */

var App = {
  employee: null,
  baseClock: null,
  alreadyRecorded: false,
  clockTimer: null,

  /* ── 초기화 ── */
  async init() {
    var token = new URLSearchParams(location.search).get('t');
    if (token) { await this.loginWithToken(token); return; }

    if (localStorage.getItem('session_token')) {
      U.showLoading('세션 확인 중...');
      var r = await API.verifySession();
      U.hideLoading();
      if (r.success) { this.employee = r.employee; localStorage.setItem('employee', JSON.stringify(r.employee)); this.showMain(); return; }
      localStorage.removeItem('session_token');
    }
    this.showLogin();
  },

  async loginWithToken(token) {
    U.showLoading('QR 인증 중...');
    var r = await API.loginToken(token);
    U.hideLoading();
    if (r.success) {
      localStorage.setItem('session_token', r.session_token);
      localStorage.setItem('employee', JSON.stringify(r.employee));
      this.employee = r.employee;
      history.replaceState({}, '', '/');
      this.showMain();
    } else { this.showLogin(r.error); }
  },

  /* ── 로그인 화면 ── */
  showLogin(err) {
    U.$('app').innerHTML =
      '<div class="min-h-dvh flex items-center justify-center p-5">' +
        '<div class="w-full max-w-sm">' +
          '<div class="text-center mb-8">' +
            '<div class="text-5xl mb-3">&#x1F3E2;</div>' +
            '<h1 class="text-xl font-bold text-gray-900">한국기업평가 노조</h1>' +
            '<p class="text-sm text-gray-500 mt-1">시간외근무 기록 시스템</p>' +
          '</div>' +
          (err ? '<div class="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">' + err + '</div>' : '') +
          '<div class="bg-white rounded-2xl p-6 shadow-md">' +
            '<div class="mb-4"><label class="block text-xs font-semibold text-gray-600 mb-1.5">사번</label>' +
              '<input id="inp-id" type="text" placeholder="사번을 입력하세요" class="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"></div>' +
            '<div class="mb-5"><label class="block text-xs font-semibold text-gray-600 mb-1.5">비밀번호</label>' +
              '<input id="inp-pw" type="password" placeholder="비밀번호를 입력하세요" class="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"></div>' +
            '<button id="btn-login" class="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl text-base active:bg-blue-700 transition">로그인</button>' +
          '</div>' +
          '<p class="text-center text-xs text-gray-400 mt-4">* QR코드로 접속 시 자동 인식됩니다</p>' +
        '</div>' +
      '</div>';

    U.$('btn-login').onclick = function(){ App.doLogin(); };
    U.$('inp-pw').onkeypress = function(e){ if(e.key==='Enter') App.doLogin(); };
  },

  async doLogin() {
    var id = U.$('inp-id').value.trim();
    var pw = U.$('inp-pw').value;
    if (!id || !pw) { U.toast('사번과 비밀번호를 입력해주세요.', 'error'); return; }

    U.showLoading('로그인 중...');
    var r = await API.login(id, pw);
    U.hideLoading();

    if (r.success) {
      localStorage.setItem('session_token', r.session_token);
      localStorage.setItem('employee', JSON.stringify(r.employee));
      this.employee = r.employee;
      this.showMain();
    } else { U.toast(r.error, 'error'); }
  },

  /* ── 메인 화면 ── */
  showMain() {
    var e = this.employee;
    U.$('app').innerHTML =
      /* 헤더 */
      '<header class="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">' +
        '<div class="flex items-center gap-1.5"><span class="font-bold text-gray-900">' + e.name + '</span><span class="text-xs text-gray-400">(' + e.department + ')</span></div>' +
        '<button id="btn-out" class="p-2 rounded-lg text-gray-400 hover:bg-gray-100" title="로그아웃">' +
          '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '</button>' +
      '</header>' +

      /* 컨텐츠 영역 */
      '<div class="pb-24 px-4 pt-4" id="content">' +
        /* -- 홈 탭 -- */
        '<div id="tab-home">' +
          '<p class="text-center text-gray-500 text-sm mb-5" id="today-date">' + U.todayStr() + '</p>' +
          '<div class="bg-white rounded-2xl p-6 shadow-sm text-center mb-5">' +
            '<p class="text-xs text-gray-400 mb-2">현재 시간</p>' +
            '<div id="clock" class="text-5xl font-bold tabular-nums tracking-wider text-gray-900">--:--:--</div>' +
          '</div>' +
          '<div class="bg-white rounded-2xl shadow-sm mb-6">' +
            '<div class="flex justify-between items-center px-5 py-3.5">' +
              '<span class="text-sm text-gray-500">기준 퇴근</span>' +
              '<span class="font-semibold text-gray-900" id="base-time">--:--</span>' +
            '</div>' +
            '<div class="border-t border-gray-50 flex justify-between items-center px-5 py-3.5">' +
              '<span class="text-sm text-gray-500">시간외근무</span>' +
              '<span class="font-semibold text-blue-600" id="ot-display">-</span>' +
            '</div>' +
          '</div>' +
          '<button id="btn-clockout" class="w-full py-5 bg-blue-600 text-white text-xl font-bold rounded-2xl shadow-md active:scale-[0.98] active:bg-blue-700 transition-all">&#x23F0; 퇴근 확정</button>' +
          '<p class="text-center text-xs text-gray-400 mt-3" id="gps-msg"></p>' +
          '<div id="recorded-box" class="hidden mt-5 bg-emerald-50 rounded-2xl p-5 text-center">' +
            '<div class="text-4xl mb-2">&#x2705;</div>' +
            '<p class="font-semibold text-emerald-600 mb-2">오늘 퇴근이 기록되었습니다</p>' +
            '<div id="recorded-detail" class="text-sm text-gray-600"></div>' +
          '</div>' +
        '</div>' +

        /* -- 기록 탭 -- */
        '<div id="tab-records" class="hidden">' +
          '<div class="flex justify-between items-center mb-4">' +
            '<h2 class="text-lg font-bold">기록 조회</h2>' +
            '<select id="sel-year" class="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"></select>' +
          '</div>' +
          '<div id="records-list"></div>' +
        '</div>' +

        /* -- 내 정보 탭 -- */
        '<div id="tab-profile" class="hidden">' +
          '<h2 class="text-lg font-bold mb-4">내 정보</h2>' +
          '<div class="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">' +
            this._profRow('이름', e.name) +
            this._profRow('사번', e.employee_id) +
            this._profRow('부서', e.department) +
            this._profRow('직급', e.position || '-') +
          '</div>' +
          '<button id="btn-logout2" class="w-full mt-6 py-3.5 bg-red-500 text-white font-bold rounded-xl">로그아웃</button>' +
        '</div>' +
      '</div>' +

      /* 하단 네비게이션 */
      '<nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 flex pb-[env(safe-area-inset-bottom)] z-50">' +
        '<a href="#" data-tab="home" class="nav-item flex-1 text-center pt-2.5 pb-2 text-blue-600">' +
          '<span class="block text-xl">&#x1F3E0;</span><span class="block text-[11px] font-medium">홈</span></a>' +
        '<a href="#" data-tab="records" class="nav-item flex-1 text-center pt-2.5 pb-2 text-gray-400">' +
          '<span class="block text-xl">&#x1F4CB;</span><span class="block text-[11px] font-medium">기록</span></a>' +
        '<a href="#" data-tab="profile" class="nav-item flex-1 text-center pt-2.5 pb-2 text-gray-400">' +
          '<span class="block text-xl">&#x1F464;</span><span class="block text-[11px] font-medium">정보</span></a>' +
      '</nav>';

    this.bindMain();
    this.startClock();
    this.loadStatus();
  },

  _profRow(label, val) {
    return '<div class="flex justify-between px-5 py-3.5"><span class="text-sm text-gray-500">' + label + '</span><span class="text-sm font-semibold">' + val + '</span></div>';
  },

  bindMain() {
    U.$('btn-out').onclick = function(){ App.logout(); };
    U.$('btn-logout2').onclick = function(){ App.logout(); };
    U.$('btn-clockout').onclick = function(){ App.doClockOut(); };

    // 네비게이션
    document.querySelectorAll('.nav-item').forEach(function(a) {
      a.onclick = function(ev) {
        ev.preventDefault();
        var tab = a.dataset.tab;
        document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('text-blue-600'); n.classList.add('text-gray-400'); });
        a.classList.remove('text-gray-400'); a.classList.add('text-blue-600');
        ['home','records','profile'].forEach(function(t){ U.$('tab-'+t).classList.toggle('hidden', t !== tab); });
        if (tab === 'records') App.loadRecords();
      };
    });

    // 연도 셀렉트
    var sel = U.$('sel-year');
    var y = new Date().getFullYear();
    [y, y-1].forEach(function(yr){
      var o = document.createElement('option'); o.value = yr; o.textContent = yr + '년'; sel.appendChild(o);
    });
    sel.onchange = function(){ App.loadRecords(Number(sel.value)); };
  },

  logout() {
    localStorage.removeItem('session_token');
    localStorage.removeItem('employee');
    location.reload();
  },

  /* ── 시계 ── */
  startClock() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.tickClock();
    this.clockTimer = setInterval(function(){ App.tickClock(); }, 1000);
  },

  tickClock() {
    var now = new Date();
    var el = U.$('clock');
    if (el) el.textContent = now.toLocaleTimeString('ko-KR', { hour12: false });

    if (this.baseClock && !this.alreadyRecorded) {
      var parts = this.baseClock.split(':');
      var bm = Number(parts[0]) * 60 + Number(parts[1]);
      var nm = now.getHours() * 60 + now.getMinutes();
      var diff = nm - bm;
      var otEl = U.$('ot-display');
      if (otEl) otEl.textContent = diff > 0 ? U.fmtOT(diff) : '-';
    }
  },

  /* ── 상태 조회 ── */
  async loadStatus() {
    var r = await API.getStatus();
    if (!r || !r.success) return;

    this.baseClock = r.base_clock_out;
    var btEl = U.$('base-time');
    if (btEl) btEl.textContent = r.base_clock_out;

    if (r.already_recorded) this.markRecorded(r.today_record);
  },

  markRecorded(rec) {
    this.alreadyRecorded = true;
    var btn = U.$('btn-clockout');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '오늘 퇴근 기록 완료';
      btn.className = 'w-full py-5 bg-gray-200 text-gray-500 text-xl font-bold rounded-2xl cursor-default';
    }
    var box = U.$('recorded-box');
    if (box) box.classList.remove('hidden');
    var det = U.$('recorded-detail');
    if (det && rec) {
      var ct = typeof rec.clock_out_time === 'string' ? rec.clock_out_time : '';
      det.innerHTML = '<p>퇴근 시간: <strong>' + ct + '</strong></p><p>시간외근무: <strong>' + U.fmtOT(rec.overtime_minutes) + '</strong></p>';
    }
    var otEl = U.$('ot-display');
    if (otEl && rec) otEl.textContent = U.fmtOT(rec.overtime_minutes);
  },

  /* ── 퇴근 확정 ── */
  async doClockOut() {
    if (this.alreadyRecorded) return;
    var ok = await U.confirm('퇴근을 확정하시겠습니까?\n확정 후 수정이 불가합니다.');
    if (!ok) return;

    U.showLoading('기록 중...');

    var lat = null, lng = null;
    try {
      var pos = await new Promise(function(res, rej) {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      });
      lat = pos.coords.latitude; lng = pos.coords.longitude;
      var gm = U.$('gps-msg');
      if (gm) gm.textContent = '&#x1F4CD; 위치 확인됨';
    } catch(e) {}

    var r = await API.clockOut(lat, lng);
    U.hideLoading();

    if (r.success) {
      U.toast('퇴근이 기록되었습니다!', 'success');
      this.markRecorded(r.record);
    } else {
      U.toast(r.error, 'error');
    }
  },

  /* ── 기록 조회 ── */
  async loadRecords(year) {
    year = year || new Date().getFullYear();
    U.showLoading('기록 조회 중...');
    var r = await API.getRecords(year);
    U.hideLoading();

    var box = U.$('records-list');
    if (!box) return;

    if (!r.success || !r.records || r.records.length === 0) {
      box.innerHTML = '<div class="text-center py-12 text-gray-400 text-sm">기록이 없습니다.</div>';
      return;
    }

    // 월별 그룹핑
    var grouped = {};
    r.records.forEach(function(rec) {
      var m = rec.record_date.substring(0, 7);
      if (!grouped[m]) grouped[m] = { records: [], totalMin: 0 };
      grouped[m].records.push(rec);
      grouped[m].totalMin += rec.overtime_minutes;
    });

    var months = Object.keys(grouped).sort().reverse();
    var html = '';

    months.forEach(function(m) {
      var g = grouped[m];
      var label = m.replace('-', '년 ') + '월';
      var totalH = Math.round((g.totalMin / 60) * 10) / 10;

      html += '<div class="mb-5">';
      html += '<div class="flex justify-between items-center pb-2 mb-2 border-b-2 border-gray-200">';
      html += '<span class="font-bold text-gray-800 text-sm">' + label + '</span>';
      html += '<span class="text-xs font-semibold text-blue-600">합계: ' + totalH + '시간</span>';
      html += '</div>';

      g.records.forEach(function(rec) {
        var ds = rec.record_date.substring(5);
        html += '<div class="flex items-center bg-white rounded-xl px-4 py-3 mb-1.5 shadow-sm">';
        html += '<div class="w-20"><span class="text-sm font-semibold text-gray-800">' + ds + '</span> <span class="text-xs text-gray-400">(' + (rec.day_of_week || '') + ')</span></div>';
        html += '<div class="flex-1 text-center text-sm font-medium">' + rec.clock_out_time + '</div>';
        html += '<div class="w-24 text-right text-xs font-semibold text-blue-600">' + U.fmtOT(rec.overtime_minutes) + '</div>';
        html += '</div>';
      });

      html += '</div>';
    });

    box.innerHTML = html;
  }
};

/* ── 앱 시작 ── */
document.addEventListener('DOMContentLoaded', function() { App.init(); });
