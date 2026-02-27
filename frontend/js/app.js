/**
 * app.js - 조합원 모바일 웹 SPA
 * 로그인 · 메인(퇴근확정) · 기록조회 · 내정보
 */

/* ================================================
   유틸
   ================================================ */
function $(id){ return document.getElementById(id); }

/* 시간 문자열 파싱 (Google Sheets Date 객체 → "HH:mm" 변환) */
function parseTime(val) {
  if (!val) return '--:--';
  var s = String(val);
  // ISO date string (예: "1899-12-30T09:00:00.000Z") → KST 시간 추출
  if (s.indexOf('T') > -1 && s.length > 10) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      // UTC → KST (+9시간)
      var h = (d.getUTCHours() + 9) % 24;
      var m = d.getUTCMinutes();
      return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
    }
  }
  // "HH:mm" 또는 "HH:mm:ss" 형태
  var match = s.match(/(\d{1,2}):(\d{2})/);
  if (match) return match[1].padStart(2,'0') + ':' + match[2];
  return s;
}

var U = {
  /* 시간외근무 분→텍스트 */
  ot: function(m){
    if(!m||m<=0) return '-';
    var h=Math.floor(m/60), r=m%60;
    if(h&&r) return h+'시간 '+r+'분';
    return h ? h+'시간' : r+'분';
  },
  /* 오늘 날짜 텍스트 */
  today: function(){
    var n=new Date(), d=['일','월','화','수','목','금','토'];
    return n.getFullYear()+'.'+String(n.getMonth()+1).padStart(2,'0')+'.'+String(n.getDate()).padStart(2,'0')+' ('+d[n.getDay()]+')';
  },
  /* 로딩 */
  loading: function(msg){
    $('ld-text').textContent = msg||'로딩 중...';
    $('ld').classList.remove('hidden');
  },
  loaded: function(){ $('ld').classList.add('hidden'); },
  /* 토스트 */
  toast: function(msg, ok){
    var el = document.createElement('div');
    el.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl transition-all duration-300 opacity-0 -translate-y-3 '
      + (ok ? 'bg-emerald-500' : 'bg-red-500');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.remove('opacity-0','-translate-y-3'); });
    setTimeout(function(){ el.classList.add('opacity-0','-translate-y-3'); setTimeout(function(){ el.remove(); },300); }, 2800);
  },
  /* 확인 모달 */
  confirm: function(msg){
    return new Promise(function(res){
      var bg = document.createElement('div');
      bg.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9000] p-6';
      bg.innerHTML =
        '<div class="bg-white rounded-2xl p-6 w-full max-w-[300px] shadow-2xl">' +
          '<p class="text-center text-[15px] leading-relaxed whitespace-pre-line mb-6">' + msg + '</p>' +
          '<div class="flex gap-3">' +
            '<button id="_cn" class="flex-1 py-3 rounded-xl bg-gray-100 font-semibold text-gray-600 active:bg-gray-200">취소</button>' +
            '<button id="_co" class="flex-1 py-3 rounded-xl bg-blue-600 font-semibold text-white active:bg-blue-700">확인</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(bg);
      $('_cn').onclick = function(){ bg.remove(); res(false); };
      $('_co').onclick = function(){ bg.remove(); res(true); };
    });
  },
  /* HTML 이스케이프 */
  esc: function(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
};

/* ================================================
   앱 상태
   ================================================ */
var me = null;        // 로그인된 직원 정보
var baseClock = null; // 기준 퇴근시간
var recorded = false; // 오늘 기록 여부
var timer = null;     // 시계 인터벌

/* ================================================
   초기화
   ================================================ */
document.addEventListener('DOMContentLoaded', async function(){
  // QR 토큰 확인
  var t = new URLSearchParams(location.search).get('t');
  if (t) { await qrLogin(t); return; }

  // 저장된 세션 확인
  if (localStorage.getItem('st')) {
    U.loading('세션 확인 중...');
    var r = await API.verify();
    U.loaded();
    if (r.success) { me = r.employee; localStorage.setItem('emp', JSON.stringify(me)); showMain(); return; }
    localStorage.removeItem('st');
  }
  showLogin();
});

/* ================================================
   QR 토큰 로그인
   ================================================ */
async function qrLogin(token) {
  U.loading('QR 인증 중...');
  var r = await API.loginToken(token);
  U.loaded();
  if (r.success) {
    localStorage.setItem('st', r.session_token);
    me = r.employee; localStorage.setItem('emp', JSON.stringify(me));
    history.replaceState(null, '', location.pathname);
    showMain();
  } else {
    showLogin(r.error);
  }
}

/* ================================================
   로그인 화면
   ================================================ */
function showLogin(err) {
  $('app').innerHTML =
    '<div class="min-h-dvh flex items-center justify-center p-5">' +
      '<div class="w-full max-w-[340px]">' +
        /* 로고 */
        '<div class="text-center mb-8">' +
          '<div id="logo-icon" class="text-5xl mb-3 select-none cursor-default">&#x1F3E2;</div>' +
          '<h1 class="text-[22px] font-extrabold text-gray-900">한국기업평가 노조</h1>' +
          '<p class="text-[13px] text-gray-400 mt-1">시간외근무 기록 시스템</p>' +
        '</div>' +
        /* 에러 */
        (err ? '<div class="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4 text-center">' + U.esc(err) + '</div>' : '') +
        /* 폼 */
        '<div class="bg-white rounded-2xl p-6 shadow-lg">' +
          '<div class="mb-4">' +
            '<label class="block text-xs font-bold text-gray-500 mb-1.5">사번</label>' +
            '<input id="i-id" type="text" placeholder="사번 입력" class="w-full px-4 py-3 border-2 border-gray-100 rounded-xl text-base outline-none focus:border-blue-500 transition">' +
          '</div>' +
          '<div class="mb-5">' +
            '<label class="block text-xs font-bold text-gray-500 mb-1.5">비밀번호</label>' +
            '<input id="i-pw" type="password" placeholder="비밀번호 입력" class="w-full px-4 py-3 border-2 border-gray-100 rounded-xl text-base outline-none focus:border-blue-500 transition">' +
          '</div>' +
          '<button id="b-login" class="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl text-base active:bg-blue-700 transition">로그인</button>' +
        '</div>' +
        '<p class="text-center text-[11px] text-gray-400 mt-5">QR코드로 접속 시 자동 인식됩니다</p>' +
      '</div>' +
    '</div>';

  $('b-login').onclick = doLogin;
  $('i-pw').onkeydown = function(e){ if(e.key==='Enter') doLogin(); };
  $('i-id').focus();

  /* 관리자 히든 로그인: 로고 3번 클릭 */
  var _lc = 0, _lt = null;
  $('logo-icon').onclick = function(){
    _lc++;
    if(_lc === 1) _lt = setTimeout(function(){ _lc = 0; }, 2000);
    if(_lc >= 3){ clearTimeout(_lt); _lc = 0; showAdminModal(); }
  };
}

async function doLogin() {
  var id = $('i-id').value.trim(), pw = $('i-pw').value;
  if (!id||!pw) { U.toast('사번과 비밀번호를 입력하세요.'); return; }
  U.loading('로그인 중...');
  var r = await API.login(id, pw);
  U.loaded();
  if (r.success) {
    localStorage.setItem('st', r.session_token);
    me = r.employee; localStorage.setItem('emp', JSON.stringify(me));
    showMain();
  } else { U.toast(r.error); }
}

/* ================================================
   메인 화면
   ================================================ */
function showMain() {
  recorded = false;
  baseClock = null;

  $('app').innerHTML =
    /* ── 헤더 ── */
    '<header class="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">' +
      '<div class="flex items-center gap-1.5">' +
        '<span class="font-bold text-[15px]">' + U.esc(me.name) + '</span>' +
        '<span class="text-xs text-gray-400">' + U.esc(me.department) + '</span>' +
      '</div>' +
      '<button id="b-out" class="p-2 rounded-lg text-gray-400 active:bg-gray-100" title="로그아웃">' +
        '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
      '</button>' +
    '</header>' +

    /* ── 탭 콘텐츠 ── */
    '<div id="pages" class="px-4 pt-4 pb-28">' +

      /* 홈 */
      '<section id="pg-home">' +
        '<p class="text-center text-sm text-gray-500 mb-5">' + U.today() + '</p>' +
        '<div class="bg-white rounded-2xl p-7 shadow text-center mb-5">' +
          '<p class="text-xs text-gray-400 mb-2">현재 시간</p>' +
          '<div id="clk" class="text-[52px] font-extrabold tracking-wider tabular-nums text-gray-900 leading-none">--:--:--</div>' +
        '</div>' +
        '<div class="bg-white rounded-2xl shadow divide-y divide-gray-50 mb-6">' +
          '<div class="flex justify-between px-5 py-4"><span class="text-sm text-gray-500">기준 퇴근</span><span id="v-base" class="text-[15px] font-bold">--:--</span></div>' +
          '<div class="flex justify-between px-5 py-4"><span class="text-sm text-gray-500">시간외근무</span><span id="v-ot" class="text-[15px] font-bold text-blue-600">-</span></div>' +
        '</div>' +
        '<button id="b-clk" class="w-full py-5 bg-blue-600 text-white text-xl font-extrabold rounded-2xl shadow-lg active:scale-[0.98] active:bg-blue-700 transition-all">&#x23F0; 퇴근 확정</button>' +
        '<p id="gps-msg" class="text-center text-xs text-gray-400 mt-3"></p>' +
        /* 기록 완료 박스 */
        '<div id="done-box" class="hidden mt-5 bg-emerald-50 rounded-2xl p-6 text-center">' +
          '<div class="text-4xl mb-2">&#x2705;</div>' +
          '<p class="font-bold text-emerald-600 mb-3">오늘 퇴근이 기록되었습니다</p>' +
          '<div id="done-info" class="text-sm text-gray-600 space-y-1"></div>' +
        '</div>' +
      '</section>' +

      /* 기록 */
      '<section id="pg-rec" class="hidden">' +
        '<div class="flex items-center justify-between mb-4">' +
          '<h2 class="text-lg font-extrabold">기록 조회</h2>' +
          '<select id="sel-y" class="px-3 py-2 border-2 border-gray-100 rounded-xl text-sm bg-white focus:border-blue-500 outline-none"></select>' +
        '</div>' +
        '<div id="rec-list"></div>' +
      '</section>' +

      /* 내 정보 */
      '<section id="pg-me" class="hidden">' +
        '<h2 class="text-lg font-extrabold mb-4">내 정보</h2>' +
        '<div class="bg-white rounded-2xl shadow divide-y divide-gray-50">' +
          row('이름', me.name) + row('사번', me.employee_id) + row('부서', me.department) + row('직급', me.position||'-') +
        '</div>' +
        '<button id="b-out2" class="w-full mt-6 py-3.5 bg-red-500 text-white font-bold rounded-xl active:bg-red-600 transition">로그아웃</button>' +
      '</section>' +

    '</div>' +

    /* ── 하단 네비게이션 ── */
    '<nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 flex safe-pb z-50">' +
      '<a href="#" data-p="home" class="nv flex-1 text-center pt-2.5 pb-2 text-blue-600"><span class="block text-xl leading-none">&#x1F3E0;</span><span class="block text-[10px] font-semibold mt-0.5">홈</span></a>' +
      '<a href="#" data-p="rec"  class="nv flex-1 text-center pt-2.5 pb-2 text-gray-400"><span class="block text-xl leading-none">&#x1F4CB;</span><span class="block text-[10px] font-semibold mt-0.5">기록</span></a>' +
      '<a href="#" data-p="me"   class="nv flex-1 text-center pt-2.5 pb-2 text-gray-400"><span class="block text-xl leading-none">&#x1F464;</span><span class="block text-[10px] font-semibold mt-0.5">정보</span></a>' +
    '</nav>';

  bindMain();
  startClock();
  loadStatus();
}

function row(l,v){
  return '<div class="flex justify-between px-5 py-4"><span class="text-sm text-gray-500">' + U.esc(l) + '</span><span class="text-sm font-bold">' + U.esc(v) + '</span></div>';
}

/* ── 이벤트 바인딩 ── */
function bindMain(){
  $('b-out').onclick = $('b-out2').onclick = logout;
  $('b-clk').onclick = doClockOut;

  /* 탭 네비 */
  document.querySelectorAll('.nv').forEach(function(a){
    a.onclick = function(e){
      e.preventDefault();
      var p = a.dataset.p;
      document.querySelectorAll('.nv').forEach(function(n){ n.classList.remove('text-blue-600'); n.classList.add('text-gray-400'); });
      a.classList.remove('text-gray-400'); a.classList.add('text-blue-600');
      ['home','rec','me'].forEach(function(t){ $('pg-'+t).classList.toggle('hidden', t!==p); });
      if(p==='rec') loadRecords();
    };
  });

  /* 연도 셀렉트 */
  var sel = $('sel-y'), y = new Date().getFullYear();
  [y, y-1].forEach(function(yr){ var o=document.createElement('option'); o.value=yr; o.textContent=yr+'년'; sel.appendChild(o); });
  sel.onchange = function(){ loadRecords(Number(sel.value)); };
}

function logout(){
  localStorage.removeItem('st');
  localStorage.removeItem('emp');
  location.reload();
}

/* ================================================
   시계
   ================================================ */
function startClock(){
  if(timer) clearInterval(timer);
  tick();
  timer = setInterval(tick, 1000);
}

function tick(){
  var now = new Date();
  var el = $('clk');
  if(el) el.textContent = now.toLocaleTimeString('ko-KR',{hour12:false});

  if(baseClock && !recorded){
    var bp = baseClock.split(':');
    var bm = Number(bp[0])*60 + Number(bp[1]);
    var nm = now.getHours()*60 + now.getMinutes();
    var d = nm - bm;
    var oe = $('v-ot');
    if(oe) oe.textContent = d > 0 ? U.ot(d) : '-';
  }
}

/* ================================================
   상태 조회
   ================================================ */
async function loadStatus(){
  var r = await API.status();
  if(!r||!r.success) return;
  baseClock = parseTime(r.base_clock_out);
  var be = $('v-base');
  if(be) be.textContent = baseClock;
  if(r.already_recorded) markDone(r.today_record);
}

function markDone(rec){
  recorded = true;
  var btn = $('b-clk');
  if(btn){ btn.disabled=true; btn.textContent='오늘 퇴근 기록 완료'; btn.className='w-full py-5 bg-gray-200 text-gray-500 text-xl font-extrabold rounded-2xl cursor-default'; }
  $('done-box').classList.remove('hidden');
  if(rec){
    var ct = typeof rec.clock_out_time === 'string' ? rec.clock_out_time : '';
    $('done-info').innerHTML = '<p>퇴근 시간: <strong>'+ct+'</strong></p><p>시간외근무: <strong>'+U.ot(rec.overtime_minutes)+'</strong></p>';
    var oe = $('v-ot'); if(oe) oe.textContent = U.ot(rec.overtime_minutes);
  }
}

/* ================================================
   퇴근 확정
   ================================================ */
async function doClockOut(){
  if(recorded) return;
  var ok = await U.confirm('퇴근을 확정하시겠습니까?\n확정 후 수정이 불가합니다.');
  if(!ok) return;

  U.loading('기록 중...');

  /* GPS */
  var lat=null, lng=null;
  try {
    var pos = await new Promise(function(res,rej){
      navigator.geolocation.getCurrentPosition(res, rej, {enableHighAccuracy:true, timeout:10000, maximumAge:0});
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    var gm = $('gps-msg');
    if(gm) gm.innerHTML = '<span class="text-emerald-500 font-medium">&#x1F4CD; 위치 확인됨</span>';
  } catch(e){
    var gm2 = $('gps-msg');
    if(gm2) gm2.innerHTML = '<span class="text-gray-400">위치 정보 없음</span>';
  }

  var r = await API.clockOut(lat, lng);
  U.loaded();

  if(r.success){
    U.toast('퇴근이 기록되었습니다!', true);
    markDone(r.record);
  } else {
    U.toast(r.error);
  }
}

/* ================================================
   관리자 히든 로그인
   ================================================ */
function showAdminModal(){
  var bg = document.createElement('div');
  bg.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9000] p-6';
  bg.innerHTML =
    '<div class="bg-white rounded-2xl p-6 w-full max-w-[300px] shadow-2xl">' +
      '<h3 class="text-center font-extrabold text-lg mb-1">관리자 로그인</h3>' +
      '<p class="text-center text-xs text-gray-400 mb-4">관리자 비밀번호를 입력하세요</p>' +
      '<input id="adm-pw" type="password" placeholder="비밀번호" class="w-full px-4 py-3 border-2 border-gray-100 rounded-xl text-base outline-none focus:border-blue-500 mb-3">' +
      '<button id="adm-go" class="w-full py-3 bg-slate-700 text-white font-bold rounded-xl active:bg-slate-800 transition">로그인</button>' +
      '<button id="adm-x" class="w-full py-2 mt-2 text-sm text-gray-400">취소</button>' +
    '</div>';
  document.body.appendChild(bg);
  $('adm-x').onclick = function(){ bg.remove(); };
  bg.onclick = function(e){ if(e.target === bg) bg.remove(); };
  $('adm-go').onclick = function(){ _doAdmLogin(bg); };
  $('adm-pw').onkeydown = function(e){ if(e.key==='Enter') _doAdmLogin(bg); };
  $('adm-pw').focus();
}

async function _doAdmLogin(modal){
  var pw = $('adm-pw').value;
  if(!pw){ U.toast('비밀번호를 입력하세요.'); return; }
  U.loading('관리자 인증 중...');
  var r = await API.adminLogin(pw);
  U.loaded();
  if(r.success){
    localStorage.setItem('adm_st', r.session_token);
    modal.remove();
    location.href = '/admin/';
  } else {
    U.toast(r.error || '인증 실패');
  }
}

/* ================================================
   기록 조회
   ================================================ */
async function loadRecords(year){
  year = year || new Date().getFullYear();
  U.loading('기록 조회 중...');
  var r = await API.records(year);
  U.loaded();

  var box = $('rec-list');
  if(!box) return;

  if(!r.success || !r.records || r.records.length===0){
    box.innerHTML = '<div class="text-center py-16 text-gray-400 text-sm">기록이 없습니다.</div>';
    return;
  }

  /* 월별 그룹핑 */
  var g = {};
  r.records.forEach(function(rec){
    var m = rec.record_date.substring(0,7);
    if(!g[m]) g[m] = {recs:[], min:0};
    g[m].recs.push(rec);
    g[m].min += (rec.overtime_minutes||0);
  });

  var months = Object.keys(g).sort().reverse();
  var html = '';

  months.forEach(function(m){
    var info = g[m];
    var label = m.replace('-','년 ') + '월';
    var hrs = Math.round(info.min / 60 * 10) / 10;

    html += '<div class="mb-6">';
    html += '<div class="flex justify-between items-center pb-2 mb-2 border-b-2 border-gray-200">';
    html += '<span class="text-sm font-extrabold text-gray-800">' + label + '</span>';
    html += '<span class="text-xs font-bold text-blue-600">합계 ' + hrs + '시간</span>';
    html += '</div>';

    info.recs.forEach(function(rec){
      var ds = rec.record_date.substring(5);
      html += '<div class="flex items-center bg-white rounded-xl px-4 py-3 mb-1.5 shadow-sm">';
      html += '<div class="w-[76px]"><span class="text-sm font-bold text-gray-800">' + ds + '</span> <span class="text-[11px] text-gray-400">(' + (rec.day_of_week||'') + ')</span></div>';
      html += '<div class="flex-1 text-center text-sm font-semibold text-gray-700">' + rec.clock_out_time + '</div>';
      html += '<div class="w-[88px] text-right text-xs font-bold text-blue-600">' + U.ot(rec.overtime_minutes) + '</div>';
      html += '</div>';
    });

    html += '</div>';
  });

  box.innerHTML = html;
}
