/**
 * admin.js - 관리자 대시보드 SPA (self-contained)
 * API 모듈 내장 · Chart.js 차트 · QR 일괄생성 · 직원관리 · CSV · 설정
 */

/* ================================================
   API 모듈 (인라인 - 경로 의존성 제거)
   ================================================ */
var API_BASE = 'https://script.google.com/macros/s/AKfycbzE_jenZo_g-B-7nr8anny6xRNUpts8L9LHIv2OQIUkW8PHFmY41_Wq1iUDmabHp-G5oA/exec';

var API = {
  call: function(action, extra) {
    var body = Object.assign(
      { action: action, session_token: localStorage.getItem('adm_st') || '' },
      extra || {}
    );
    return fetch(API_BASE, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (!d.success && d.error && d.error.indexOf('세션') > -1) {
        localStorage.removeItem('adm_st');
        location.reload();
      }
      return d;
    })
    .catch(function(e){
      console.error('API error:', e);
      return { success:false, error:'서버 통신 오류가 발생했습니다.' };
    });
  },
  adminLogin:   function(pw)   { return this.call('admin_login', {password:pw}); },
  dashboard:    function(ym)   { return this.call('get_dashboard_data', {year_month:ym}); },
  allStats:     function(ym)   { return this.call('get_all_stats', {year_month:ym}); },
  genAllQR:     function(base) { return this.call('generate_all_qr', {base_url:base}); },
  addEmp:       function(d)    { return this.call('add_employee', d); },
  employees:    function()     { return this.call('get_employees'); },
  saveSettings: function(arr)  { return this.call('update_settings', {settings:arr}); },
  getSettings:  function()     { return this.call('get_settings'); }
};

/* ================================================
   유틸
   ================================================ */
function $(id){ return document.getElementById(id); }
var charts = {};
var curYM = (function(){ var n=new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0'); })();

/* ================================================
   초기화
   ================================================ */
document.addEventListener('DOMContentLoaded', function(){
  try {
    var tk = localStorage.getItem('adm_st');
    if(tk){ showApp(); }
    else { showLogin(); }
  } catch(e) {
    console.error('Init error:', e);
    $('root').innerHTML = '<p style="text-align:center;padding:40px;color:red">초기화 오류: ' + e.message + '</p>';
  }
});

/* ================================================
   로그인
   ================================================ */
function showLogin(){
  $('root').innerHTML =
    '<div class="min-h-screen flex items-center justify-center p-5">' +
      '<div class="w-full max-w-sm text-center">' +
        '<h1 class="text-2xl font-extrabold mb-2">관리자 로그인</h1>' +
        '<p class="text-sm text-gray-500 mb-6">한국기업평가 노조 시간외근무 관리</p>' +
        '<div class="space-y-3">' +
          '<input id="pw" type="password" placeholder="관리자 비밀번호" class="w-full px-4 py-3.5 border-2 border-gray-100 rounded-xl text-base outline-none focus:border-blue-500">' +
          '<button id="bl" class="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">로그인</button>' +
        '</div>' +
        '<p id="login-err" class="text-red-500 text-sm mt-3 hidden"></p>' +
      '</div>' +
    '</div>';
  $('bl').onclick = doAdmLogin;
  $('pw').onkeydown = function(e){ if(e.key==='Enter') doAdmLogin(); };
  $('pw').focus();
}

async function doAdmLogin(){
  var p = $('pw').value;
  if(!p){ alert('비밀번호를 입력하세요.'); return; }
  $('bl').disabled = true;
  $('bl').textContent = '로그인 중...';
  var r = await API.adminLogin(p);
  if(r.success){
    localStorage.setItem('adm_st', r.session_token);
    showApp();
  } else {
    $('bl').disabled = false;
    $('bl').textContent = '로그인';
    var errEl = $('login-err');
    errEl.textContent = r.error || '인증 실패';
    errEl.classList.remove('hidden');
  }
}

/* ================================================
   메인 앱
   ================================================ */
function showApp(){
  $('root').innerHTML =
    /* 헤더 */
    '<header class="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between">' +
      '<h1 class="text-lg font-extrabold">&#x1F4CA; 관리자 대시보드</h1>' +
      '<div class="flex items-center gap-3">' +
        '<select id="ym" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"></select>' +
        '<button id="bo" class="text-sm text-gray-500 hover:text-red-500 font-semibold">로그아웃</button>' +
      '</div>' +
    '</header>' +

    /* 탭 */
    '<nav class="bg-white border-b border-gray-200 flex overflow-x-auto">' +
      '<button class="tb px-5 py-3 text-sm font-semibold border-b-2 border-blue-600 text-blue-600 whitespace-nowrap" data-t="dash">대시보드</button>' +
      '<button class="tb px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-gray-500 whitespace-nowrap" data-t="stat">통계 목록</button>' +
      '<button class="tb px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-gray-500 whitespace-nowrap" data-t="emp">직원 관리</button>' +
      '<button class="tb px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-gray-500 whitespace-nowrap" data-t="set">설정</button>' +
    '</nav>' +

    /* ── 대시보드 ── */
    '<div id="p-dash" class="p-4 lg:p-6 space-y-5">' +
      '<div id="cards" class="grid grid-cols-2 lg:grid-cols-4 gap-3"></div>' +
      '<div class="bg-white rounded-xl p-5 shadow-sm"><canvas id="cDept"></canvas></div>' +
      '<div class="bg-white rounded-xl p-5 shadow-sm"><canvas id="cTop"></canvas></div>' +
      '<div class="bg-white rounded-xl p-5 shadow-sm"><canvas id="cTrend"></canvas></div>' +
    '</div>' +

    /* ── 통계 목록 ── */
    '<div id="p-stat" class="hidden p-4 lg:p-6">' +
      '<div class="flex justify-end gap-2 mb-3">' +
        '<button id="bcsv" class="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">CSV 내보내기</button>' +
      '</div>' +
      '<div class="bg-white rounded-xl shadow-sm overflow-x-auto">' +
        '<table class="w-full text-sm">' +
          '<thead><tr class="bg-gray-50 text-left">' +
            '<th class="px-3 py-3 font-bold">사번</th><th class="px-3 py-3 font-bold">이름</th><th class="px-3 py-3 font-bold">부서</th><th class="px-3 py-3 font-bold">년월</th><th class="px-3 py-3 font-bold">시간외(h)</th><th class="px-3 py-3 font-bold">출근일</th><th class="px-3 py-3 font-bold">초과일</th>' +
          '</tr></thead>' +
          '<tbody id="stb"></tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +

    /* ── 직원 관리 ── */
    '<div id="p-emp" class="hidden p-4 lg:p-6 space-y-5">' +
      '<div class="bg-white rounded-xl p-5 shadow-sm">' +
        '<h3 class="font-extrabold mb-4">직원 추가</h3>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">' +
          inp('ne-id','사번 *','EMP004') + inp('ne-nm','이름 *','홍길동') + inp('ne-dp','부서 *','경영지원팀') + inp('ne-ps','직급','대리') +
        '</div>' +
        '<button id="badd" class="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700">직원 추가 (초기 비밀번호: 0000)</button>' +
      '</div>' +
      '<div class="bg-white rounded-xl p-5 shadow-sm">' +
        '<h3 class="font-extrabold mb-2">QR 코드 일괄 생성</h3>' +
        '<p class="text-xs text-gray-500 mb-4">전체 직원의 QR 코드를 생성하고 인쇄용 페이지를 엽니다.</p>' +
        '<button id="bqr" class="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">QR 일괄 생성 &amp; 인쇄</button>' +
      '</div>' +
      '<div class="bg-white rounded-xl p-5 shadow-sm">' +
        '<h3 class="font-extrabold mb-3">직원 목록</h3>' +
        '<div id="elist" class="text-sm text-gray-400">불러오는 중...</div>' +
      '</div>' +
    '</div>' +

    /* ── 설정 ── */
    '<div id="p-set" class="hidden p-4 lg:p-6">' +
      '<div class="bg-white rounded-xl p-5 shadow-sm">' +
        '<h3 class="font-extrabold mb-4">기준 퇴근 시간 설정</h3>' +
        '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" id="sgrid"></div>' +
        '<button id="bsave" class="mt-4 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700">설정 저장</button>' +
      '</div>' +
    '</div>';

  bindApp();
  loadDash();
}

function inp(id,label,ph){
  return '<div><label class="block text-xs font-bold text-gray-500 mb-1">'+label+'</label><input id="'+id+'" class="w-full px-3 py-2.5 border-2 border-gray-100 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="'+ph+'"></div>';
}

/* ── 이벤트 바인딩 ── */
function bindApp(){
  $('bo').onclick = function(){ localStorage.removeItem('adm_st'); location.reload(); };

  var sel = $('ym'), n = new Date();
  for(var i=0;i<12;i++){
    var d = new Date(n.getFullYear(), n.getMonth()-i, 1);
    var v = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    var o = document.createElement('option');
    o.value=v; o.textContent=d.getFullYear()+'년 '+(d.getMonth()+1)+'월';
    if(v===curYM) o.selected=true;
    sel.appendChild(o);
  }
  sel.onchange = function(){ curYM=sel.value; loadDash(); };

  document.querySelectorAll('.tb').forEach(function(b){
    b.onclick = function(){
      document.querySelectorAll('.tb').forEach(function(x){ x.classList.remove('border-blue-600','text-blue-600'); x.classList.add('border-transparent','text-gray-500'); });
      b.classList.add('border-blue-600','text-blue-600'); b.classList.remove('border-transparent','text-gray-500');
      ['dash','stat','emp','set'].forEach(function(t){ $('p-'+t).classList.toggle('hidden', t!==b.dataset.t); });
      if(b.dataset.t==='stat') loadStats();
      if(b.dataset.t==='emp') loadEmpList();
      if(b.dataset.t==='set') loadSettings();
    };
  });

  $('badd').onclick = addEmp;
  $('bqr').onclick = printQR;
  $('bcsv').onclick = exportCSV;
}

/* ================================================
   대시보드
   ================================================ */
async function loadDash(){
  var r = await API.dashboard(curYM);
  if(!r.success){ $('cards').innerHTML = '<div class="col-span-full text-center py-8 text-gray-400 text-sm">데이터를 불러올 수 없습니다.</div>'; return; }

  var ds = r.department_summary || [];
  var te = r.total_employees || 0;
  var top = r.top_overtime_employees || [];
  var wt = r.weekly_trend || [];

  var th = ds.reduce(function(s,d){return s+d.total_hours;},0);
  var avg = te > 0 ? (th/te).toFixed(1) : '0';
  $('cards').innerHTML =
    card(te,'총 인원') + card(th.toFixed(1),'총 시간외(h)') +
    card(avg,'인당 평균(h)') + card(ds.length,'부서 수');

  if(typeof Chart === 'undefined') return; // Chart.js 로딩 전이면 스킵

  mkChart('dept', 'cDept', 'bar', {
    labels: ds.map(function(d){return d.department;}),
    datasets: [
      { label:'총 시간외(h)', data:ds.map(function(d){return d.total_hours;}), backgroundColor:'rgba(37,99,235,0.7)' },
      { label:'인당 평균(h)', data:ds.map(function(d){return d.avg_hours;}), backgroundColor:'rgba(16,185,129,0.7)' }
    ]
  }, { plugins:{ title:{ display:true, text:'부서별 시간외근무' } } });

  mkChart('top', 'cTop', 'bar', {
    labels: top.map(function(d){return d.name+' ('+d.department+')';}),
    datasets: [{ label:'시간외(h)', data:top.map(function(d){return d.total_hours;}),
      backgroundColor:top.map(function(_,i){return i<3?'rgba(239,68,68,0.7)':'rgba(37,99,235,0.5)';}) }]
  }, { indexAxis:'y', plugins:{ title:{ display:true, text:'시간외근무 상위 10명' } } });

  mkChart('trend', 'cTrend', 'line', {
    labels: wt.map(function(w){return w.week;}),
    datasets: [{ label:'주간 시간외(h)', data:wt.map(function(w){return w.total_hours;}),
      borderColor:'rgb(37,99,235)', fill:true, backgroundColor:'rgba(37,99,235,0.08)', tension:0.3 }]
  }, { plugins:{ title:{ display:true, text:'주간 시간외근무 추이' } } });
}

function card(v,l){
  return '<div class="bg-white rounded-xl p-4 shadow-sm text-center"><div class="text-2xl font-extrabold text-blue-600">'+v+'</div><div class="text-xs text-gray-500 mt-1">'+l+'</div></div>';
}

function mkChart(key, canvasId, type, data, opts){
  if(charts[key]) charts[key].destroy();
  charts[key] = new Chart($(canvasId), { type:type, data:data, options:Object.assign({responsive:true}, opts||{}) });
}

/* ================================================
   통계 목록
   ================================================ */
async function loadStats(){
  var r = await API.allStats(curYM);
  if(!r.success){ $('stb').innerHTML='<tr><td colspan="7" class="px-3 py-10 text-center text-red-400">데이터 로드 실패: '+(r.error||'알 수 없는 오류')+'</td></tr>'; return; }
  var tb = $('stb');
  if(!r.stats || !r.stats.length){ tb.innerHTML='<tr><td colspan="7" class="px-3 py-10 text-center text-gray-400">데이터 없음</td></tr>'; return; }
  tb.innerHTML = r.stats.map(function(s){
    return '<tr class="border-t border-gray-50 hover:bg-gray-50"><td class="px-3 py-2.5">'+s.employee_id+'</td><td class="px-3 py-2.5">'+s.name+'</td><td class="px-3 py-2.5">'+s.department+'</td><td class="px-3 py-2.5">'+s.year_month+'</td><td class="px-3 py-2.5 font-bold">'+s.total_overtime_hours+'h</td><td class="px-3 py-2.5">'+s.work_days+'</td><td class="px-3 py-2.5">'+s.overtime_days+'</td></tr>';
  }).join('');
}

/* ================================================
   CSV 내보내기
   ================================================ */
async function exportCSV(){
  var r = await API.allStats(curYM);
  if(!r.success||!r.stats||!r.stats.length){ alert('데이터 없음'); return; }
  var hd = ['사번','이름','부서','년월','시간외(h)','출근일','초과일','평균(분)'];
  var rows = r.stats.map(function(s){return [s.employee_id,s.name,s.department,s.year_month,s.total_overtime_hours,s.work_days,s.overtime_days,s.avg_overtime_minutes];});
  var csv = '\uFEFF' + [hd].concat(rows).map(function(r){return r.join(',');}).join('\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = '시간외근무_'+curYM+'.csv';
  a.click();
}

/* ================================================
   직원 추가
   ================================================ */
async function addEmp(){
  var id=$('ne-id').value.trim(), nm=$('ne-nm').value.trim(), dp=$('ne-dp').value.trim(), ps=$('ne-ps').value.trim();
  if(!id||!nm||!dp){ alert('사번, 이름, 부서는 필수입니다.'); return; }
  var r = await API.addEmp({ employee_id:id, name:nm, department:dp, position:ps, initial_password:'0000', base_url:location.origin });
  if(r.success){
    alert('직원 추가 완료!\n사번: '+id+'\n초기 비밀번호: 0000');
    $('ne-id').value=''; $('ne-nm').value=''; $('ne-dp').value=''; $('ne-ps').value='';
    loadEmpList();
  } else { alert('실패: '+r.error); }
}

/* ================================================
   직원 목록
   ================================================ */
async function loadEmpList(){
  var r = await API.employees();
  if(!r.success) return;
  var el = $('elist');
  if(!r.employees||!r.employees.length){ el.innerHTML='직원 없음'; return; }
  el.innerHTML =
    '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-gray-50">' +
    '<th class="px-3 py-2 text-left font-bold">사번</th><th class="px-3 py-2 text-left font-bold">이름</th><th class="px-3 py-2 text-left font-bold">부서</th><th class="px-3 py-2 text-left font-bold">직급</th><th class="px-3 py-2 text-left font-bold">상태</th></tr></thead><tbody>' +
    r.employees.map(function(e){
      var badge = e.is_active ? '<span class="text-emerald-600 font-bold">활성</span>' : '<span class="text-red-500 font-bold">비활성</span>';
      return '<tr class="border-t border-gray-50"><td class="px-3 py-2">'+e.employee_id+'</td><td class="px-3 py-2">'+e.name+'</td><td class="px-3 py-2">'+e.department+'</td><td class="px-3 py-2">'+(e.position||'-')+'</td><td class="px-3 py-2">'+badge+'</td></tr>';
    }).join('') +
    '</tbody></table></div>';
}

/* ================================================
   QR 일괄 생성 & 인쇄
   ================================================ */
async function printQR(){
  if(!confirm('전체 직원 QR 코드를 생성하시겠습니까?')) return;
  var r = await API.genAllQR(location.origin);
  if(!r.success){ alert('QR 생성 실패: '+r.error); return; }

  var w = window.open('','_blank');
  w.document.write(
    '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>QR 코드 - 한국기업평가 노조</title>' +
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>' +
    '<style>*{margin:0;box-sizing:border-box}body{font-family:sans-serif;padding:24px}h2{font-size:18px;margin-bottom:4px}' +
    '.g{display:flex;flex-wrap:wrap;gap:14px;margin-top:18px}' +
    '.c{width:200px;padding:16px;border:1px solid #ddd;border-radius:10px;text-align:center;page-break-inside:avoid}' +
    '.c .n{font-weight:700;font-size:15px;margin-top:10px}.c .d{color:#666;font-size:12px;margin-top:2px}.c .i{color:#999;font-size:11px;margin-top:2px}' +
    '@media print{.np{display:none!important}}</style></head>' +
    '<body><h2>한국기업평가 노동조합 - QR 코드</h2>' +
    '<p style="color:#666;font-size:13px">생성일: '+new Date().toLocaleDateString('ko-KR')+' | '+r.count+'명</p>' +
    '<button class="np" onclick="window.print()" style="margin-top:10px;padding:8px 24px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#f5f5f5">&#x1F5A8; 인쇄하기</button><hr style="margin:16px 0">' +
    '<div class="g" id="qc"></div>' +
    '<script>' +
    'var emps='+JSON.stringify(r.results)+';' +
    'var c=document.getElementById("qc");' +
    'emps.forEach(function(e){' +
      'var d=document.createElement("div");d.className="c";' +
      'd.innerHTML=\'<div id="q-\'+e.employee_id+\'"></div><div class="n">\'+e.name+\'</div><div class="d">\'+e.department+\'</div><div class="i">\'+e.employee_id+\'</div>\';' +
      'c.appendChild(d);' +
      'new QRCode(document.getElementById("q-"+e.employee_id),{text:e.qr_url,width:150,height:150,correctLevel:QRCode.CorrectLevel.M});' +
    '});' +
    '<\/script></body></html>'
  );
}

/* ================================================
   설정
   ================================================ */
async function loadSettings(){
  var grid = $('sgrid');
  var days = [{k:'mon',l:'월'},{k:'tue',l:'화'},{k:'wed',l:'수'},{k:'thu',l:'목'},{k:'fri',l:'금'},{k:'sat',l:'토'},{k:'sun',l:'일'}];

  var r = await API.getSettings();
  var sv = (r && r.success && r.settings) ? r.settings : {};

  grid.innerHTML = days.map(function(d){
    var val = sv['base_clock_out_'+d.k] || (d.k==='sat'||d.k==='sun' ? '00:00' : '18:00');
    return '<div class="flex items-center gap-2"><label class="text-sm font-semibold min-w-[28px]">'+d.l+'</label>' +
      '<input type="time" id="s-'+d.k+'" value="'+val+'" class="flex-1 px-3 py-2 border-2 border-gray-100 rounded-lg text-sm outline-none focus:border-blue-500"></div>';
  }).join('');

  $('bsave').onclick = async function(){
    var arr = days.map(function(d){ return { key:'base_clock_out_'+d.k, value:$('s-'+d.k).value }; });
    var res = await API.saveSettings(arr);
    alert(res.success ? '설정이 저장되었습니다.' : '실패: '+res.error);
  };
}
