/**
 * admin.js - 관리자 대시보드 & 관리 기능
 * Chart.js + Tailwind CSS
 */

/* ============================
   관리자 앱
   ============================ */

var Admin = {
  charts: {},
  ym: null,

  init() {
    this.ym = this.curYM();
    var st = localStorage.getItem('admin_session');
    if (st) {
      localStorage.setItem('session_token', st);
      this.showDashboard();
    } else {
      this.showLogin();
    }
  },

  curYM() {
    var n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0');
  },

  /* ── 로그인 ── */
  showLogin() {
    $('admin-app').innerHTML =
      '<div class="min-h-screen flex items-center justify-center p-5">' +
        '<div class="w-full max-w-sm text-center">' +
          '<h1 class="text-2xl font-bold mb-2">관리자 로그인</h1>' +
          '<p class="text-sm text-gray-500 mb-6">한국기업평가 노조 시간외근무 관리</p>' +
          '<div class="space-y-3">' +
            '<input id="adm-pw" type="password" placeholder="관리자 비밀번호" class="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500">' +
            '<button id="adm-login" class="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl text-base hover:bg-blue-700 transition">로그인</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    $('adm-login').onclick = function(){ Admin.doLogin(); };
    $('adm-pw').onkeypress = function(e){ if(e.key==='Enter') Admin.doLogin(); };
  },

  async doLogin() {
    var pw = $('adm-pw').value;
    if (!pw) { alert('비밀번호를 입력하세요.'); return; }
    var r = await API.adminLogin(pw);
    if (r.success) {
      localStorage.setItem('session_token', r.session_token);
      localStorage.setItem('admin_session', r.session_token);
      this.showDashboard();
    } else { alert(r.error); }
  },

  /* ── 대시보드 레이아웃 ── */
  showDashboard() {
    $('admin-app').innerHTML =
      /* 헤더 */
      '<header class="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between">' +
        '<h1 class="text-lg font-bold">관리자 대시보드</h1>' +
        '<div class="flex items-center gap-3">' +
          '<select id="ym-sel" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"></select>' +
          '<button id="adm-out" class="text-sm text-gray-500 hover:text-red-500">로그아웃</button>' +
        '</div>' +
      '</header>' +

      /* 탭 */
      '<nav class="bg-white border-b border-gray-200 flex overflow-x-auto px-4">' +
        '<button class="adm-tab whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600" data-tab="dash">대시보드</button>' +
        '<button class="adm-tab whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500" data-tab="stats">통계 목록</button>' +
        '<button class="adm-tab whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500" data-tab="emp">직원 관리</button>' +
        '<button class="adm-tab whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500" data-tab="set">설정</button>' +
      '</nav>' +

      /* 대시보드 탭 */
      '<div id="p-dash" class="p-4 lg:p-6 space-y-5">' +
        '<div id="cards" class="grid grid-cols-2 lg:grid-cols-4 gap-3"></div>' +
        '<div class="bg-white rounded-xl p-4 shadow-sm"><canvas id="c-dept"></canvas></div>' +
        '<div class="bg-white rounded-xl p-4 shadow-sm"><canvas id="c-top"></canvas></div>' +
        '<div class="bg-white rounded-xl p-4 shadow-sm"><canvas id="c-trend"></canvas></div>' +
      '</div>' +

      /* 통계 목록 탭 */
      '<div id="p-stats" class="hidden p-4 lg:p-6">' +
        '<div class="flex justify-end mb-3"><button id="btn-csv" class="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">CSV 내보내기</button></div>' +
        '<div class="bg-white rounded-xl shadow-sm overflow-x-auto">' +
          '<table class="w-full text-sm">' +
            '<thead><tr class="bg-gray-50 text-left"><th class="px-3 py-3 font-semibold">사번</th><th class="px-3 py-3 font-semibold">이름</th><th class="px-3 py-3 font-semibold">부서</th><th class="px-3 py-3 font-semibold">년월</th><th class="px-3 py-3 font-semibold">시간외(h)</th><th class="px-3 py-3 font-semibold">출근일</th><th class="px-3 py-3 font-semibold">초과일</th></tr></thead>' +
            '<tbody id="stat-body"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +

      /* 직원 관리 탭 */
      '<div id="p-emp" class="hidden p-4 lg:p-6 space-y-5">' +
        '<div class="bg-white rounded-xl p-5 shadow-sm">' +
          '<h3 class="font-bold mb-4">직원 추가</h3>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">' +
            '<div><label class="block text-xs font-semibold text-gray-600 mb-1">사번 *</label><input id="ne-id" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="EMP001"></div>' +
            '<div><label class="block text-xs font-semibold text-gray-600 mb-1">이름 *</label><input id="ne-nm" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="홍길동"></div>' +
            '<div><label class="block text-xs font-semibold text-gray-600 mb-1">부서 *</label><input id="ne-dp" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="경영지원팀"></div>' +
            '<div><label class="block text-xs font-semibold text-gray-600 mb-1">직급</label><input id="ne-ps" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="대리"></div>' +
          '</div>' +
          '<button id="btn-add" class="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">직원 추가 (초기 비밀번호: 0000)</button>' +
        '</div>' +

        '<div class="bg-white rounded-xl p-5 shadow-sm">' +
          '<h3 class="font-bold mb-2">QR 코드 관리</h3>' +
          '<p class="text-xs text-gray-500 mb-4">전체 직원의 QR 코드를 일괄 생성하고 인쇄할 수 있습니다.</p>' +
          '<button id="btn-qr" class="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">QR 코드 일괄 생성 &amp; 인쇄</button>' +
        '</div>' +

        '<div class="bg-white rounded-xl p-5 shadow-sm">' +
          '<h3 class="font-bold mb-3">직원 목록</h3>' +
          '<div id="emp-list" class="text-sm text-gray-500">조회 중...</div>' +
        '</div>' +
      '</div>' +

      /* 설정 탭 */
      '<div id="p-set" class="hidden p-4 lg:p-6">' +
        '<div class="bg-white rounded-xl p-5 shadow-sm">' +
          '<h3 class="font-bold mb-4">기준 퇴근 시간 설정</h3>' +
          '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" id="set-grid"></div>' +
          '<button id="btn-save-set" class="mt-4 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">설정 저장</button>' +
        '</div>' +
      '</div>';

    this.bindDash();
    this.loadDash();
  },

  bindDash() {
    var self = this;

    // 로그아웃
    $('adm-out').onclick = function() {
      localStorage.removeItem('admin_session');
      localStorage.removeItem('session_token');
      location.reload();
    };

    // 월 셀렉트
    var sel = $('ym-sel');
    var now = new Date();
    for (var i = 0; i < 12; i++) {
      var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      var val = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      var o = document.createElement('option');
      o.value = val; o.textContent = d.getFullYear() + '년 ' + (d.getMonth()+1) + '월';
      if (val === self.ym) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = function() { self.ym = sel.value; self.loadDash(); };

    // 탭
    document.querySelectorAll('.adm-tab').forEach(function(btn){
      btn.onclick = function(){
        document.querySelectorAll('.adm-tab').forEach(function(b){
          b.classList.remove('border-blue-600','text-blue-600');
          b.classList.add('border-transparent','text-gray-500');
        });
        btn.classList.add('border-blue-600','text-blue-600');
        btn.classList.remove('border-transparent','text-gray-500');
        ['dash','stats','emp','set'].forEach(function(t){ $('p-'+t).classList.toggle('hidden', t !== btn.dataset.tab); });
        if (btn.dataset.tab === 'stats') self.loadStats();
        if (btn.dataset.tab === 'emp') self.loadEmployees();
        if (btn.dataset.tab === 'set') self.loadSettings();
      };
    });

    // 직원 추가
    $('btn-add').onclick = function(){ self.addEmployee(); };
    // QR
    $('btn-qr').onclick = function(){ self.printQR(); };
    // CSV
    $('btn-csv').onclick = function(){ self.exportCSV(); };
  },

  /* ── 대시보드 데이터 ── */
  async loadDash() {
    var r = await API.getDashboard(this.ym);
    if (!r.success) return;

    // 카드
    var totalH = r.department_summary.reduce(function(s,d){return s+d.total_hours;}, 0);
    var avgH = r.total_employees > 0 ? (totalH / r.total_employees).toFixed(1) : 0;
    $('cards').innerHTML =
      this._card(r.total_employees, '총 인원') +
      this._card(totalH.toFixed(1), '총 시간외(h)') +
      this._card(avgH, '인당 평균(h)') +
      this._card(r.department_summary.length, '부서 수');

    // 차트
    this.chartDept(r.department_summary);
    this.chartTop(r.top_overtime_employees);
    this.chartTrend(r.weekly_trend);
  },

  _card(v, l) {
    return '<div class="bg-white rounded-xl p-4 shadow-sm text-center"><div class="text-2xl font-bold text-blue-600">' + v + '</div><div class="text-xs text-gray-500 mt-1">' + l + '</div></div>';
  },

  chartDept(data) {
    if (this.charts.dept) this.charts.dept.destroy();
    this.charts.dept = new Chart($('c-dept'), {
      type: 'bar',
      data: {
        labels: data.map(function(d){return d.department;}),
        datasets: [
          { label: '총 시간외(h)', data: data.map(function(d){return d.total_hours;}), backgroundColor: 'rgba(37,99,235,0.7)' },
          { label: '인당 평균(h)', data: data.map(function(d){return d.avg_hours;}), backgroundColor: 'rgba(16,185,129,0.7)' }
        ]
      },
      options: { responsive: true, plugins: { title: { display: true, text: '부서별 시간외근무' } } }
    });
  },

  chartTop(data) {
    if (this.charts.top) this.charts.top.destroy();
    this.charts.top = new Chart($('c-top'), {
      type: 'bar',
      data: {
        labels: data.map(function(d){return d.name + ' (' + d.department + ')';}),
        datasets: [{ label: '시간외(h)', data: data.map(function(d){return d.total_hours;}),
          backgroundColor: data.map(function(_,i){return i<3?'rgba(239,68,68,0.7)':'rgba(37,99,235,0.5)';}) }]
      },
      options: { indexAxis: 'y', responsive: true, plugins: { title: { display: true, text: '시간외근무 상위 10명' } } }
    });
  },

  chartTrend(data) {
    if (this.charts.trend) this.charts.trend.destroy();
    this.charts.trend = new Chart($('c-trend'), {
      type: 'line',
      data: {
        labels: data.map(function(w){return w.week;}),
        datasets: [{ label: '주간 시간외(h)', data: data.map(function(w){return w.total_hours;}),
          borderColor: 'rgb(37,99,235)', fill: true, backgroundColor: 'rgba(37,99,235,0.1)' }]
      },
      options: { responsive: true, plugins: { title: { display: true, text: '주간 시간외근무 추이' } } }
    });
  },

  /* ── 통계 목록 ── */
  async loadStats() {
    var r = await API.getAllStats(this.ym);
    if (!r.success) return;

    var tb = $('stat-body');
    if (r.stats.length === 0) {
      tb.innerHTML = '<tr><td colspan="7" class="px-3 py-8 text-center text-gray-400">데이터 없음</td></tr>';
      return;
    }
    tb.innerHTML = r.stats.map(function(s){
      return '<tr class="border-t border-gray-50 hover:bg-gray-50"><td class="px-3 py-2.5">' + s.employee_id + '</td><td class="px-3 py-2.5">' + s.name + '</td><td class="px-3 py-2.5">' + s.department + '</td><td class="px-3 py-2.5">' + s.year_month + '</td><td class="px-3 py-2.5 font-semibold">' + s.total_overtime_hours + 'h</td><td class="px-3 py-2.5">' + s.work_days + '</td><td class="px-3 py-2.5">' + s.overtime_days + '</td></tr>';
    }).join('');
  },

  /* ── CSV 내보내기 ── */
  async exportCSV() {
    var r = await API.getAllStats(this.ym);
    if (!r.success || r.stats.length === 0) { alert('데이터 없음'); return; }

    var hd = ['사번','이름','부서','년월','시간외(h)','출근일','초과일','평균(분)'];
    var rows = r.stats.map(function(s){return [s.employee_id,s.name,s.department,s.year_month,s.total_overtime_hours,s.work_days,s.overtime_days,s.avg_overtime_minutes];});
    var csv = '\uFEFF' + [hd].concat(rows).map(function(r){return r.join(',');}).join('\n');

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '시간외근무_' + (this.ym||'전체') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /* ── 직원 관리 ── */
  async addEmployee() {
    var id = $('ne-id').value.trim(), nm = $('ne-nm').value.trim(), dp = $('ne-dp').value.trim(), ps = $('ne-ps').value.trim();
    if (!id || !nm || !dp) { alert('사번, 이름, 부서는 필수입니다.'); return; }

    var r = await API.addEmployee({ employee_id: id, name: nm, department: dp, position: ps, initial_password: '0000', base_url: location.origin });
    if (r.success) {
      alert('직원 추가 완료!\n사번: ' + id + '\nQR URL: ' + r.qr_url + '\n초기 비밀번호: 0000');
      $('ne-id').value = ''; $('ne-nm').value = ''; $('ne-dp').value = ''; $('ne-ps').value = '';
      this.loadEmployees();
    } else { alert('실패: ' + r.error); }
  },

  async loadEmployees() {
    var r = await API.getEmployees();
    if (!r.success) return;

    var box = $('emp-list');
    if (r.employees.length === 0) { box.innerHTML = '직원 없음'; return; }

    box.innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left font-semibold">사번</th><th class="px-3 py-2 text-left font-semibold">이름</th><th class="px-3 py-2 text-left font-semibold">부서</th><th class="px-3 py-2 text-left font-semibold">직급</th><th class="px-3 py-2 text-left font-semibold">상태</th></tr></thead><tbody>' +
      r.employees.map(function(e){
        var badge = e.is_active ? '<span class="text-emerald-600 font-semibold">활성</span>' : '<span class="text-red-500">비활성</span>';
        return '<tr class="border-t border-gray-50"><td class="px-3 py-2">' + e.employee_id + '</td><td class="px-3 py-2">' + e.name + '</td><td class="px-3 py-2">' + e.department + '</td><td class="px-3 py-2">' + (e.position||'-') + '</td><td class="px-3 py-2">' + badge + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  },

  /* ── QR 일괄 인쇄 ── */
  async printQR() {
    if (!confirm('전체 직원 QR 코드를 생성하시겠습니까?')) return;

    var r = await API.genAllQR(location.origin);
    if (!r.success) { alert('QR 생성 실패: ' + r.error); return; }

    var w = window.open('', '_blank');
    w.document.write(
      '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>QR 코드 - 한국기업평가 노조</title>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>' +
      '<style>body{font-family:sans-serif;padding:20px}h2{margin-bottom:4px}.g{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}.c{width:200px;padding:16px;border:1px solid #ddd;border-radius:8px;text-align:center;page-break-inside:avoid}.c .n{font-weight:700;font-size:15px;margin-top:8px}.c .d{color:#666;font-size:12px}.c .i{color:#999;font-size:11px;margin-top:2px}@media print{.np{display:none}}</style></head>' +
      '<body><h2>한국기업평가 노동조합 - QR 코드</h2>' +
      '<p>생성일: ' + new Date().toLocaleDateString('ko-KR') + ' | ' + r.count + '명</p>' +
      '<button class="np" onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;margin-top:8px">인쇄</button><hr>' +
      '<div class="g" id="qc"></div>' +
      '<script>var emps=' + JSON.stringify(r.results) + ';var c=document.getElementById("qc");' +
      'emps.forEach(function(e){var d=document.createElement("div");d.className="c";d.innerHTML=\'<div id="q-\'+e.employee_id+\'"></div><div class="n">\'+e.name+\'</div><div class="d">\'+e.department+\'</div><div class="i">\'+e.employee_id+\'</div>\';c.appendChild(d);' +
      'new QRCode(document.getElementById("q-"+e.employee_id),{text:e.qr_url,width:150,height:150,correctLevel:QRCode.CorrectLevel.M});});<\/script></body></html>'
    );
  },

  /* ── 설정 ── */
  loadSettings() {
    var grid = $('set-grid');
    var days = [
      {k:'mon',l:'월요일'},{k:'tue',l:'화요일'},{k:'wed',l:'수요일'},{k:'thu',l:'목요일'},
      {k:'fri',l:'금요일'},{k:'sat',l:'토요일'},{k:'sun',l:'일요일'}
    ];

    grid.innerHTML = days.map(function(d){
      return '<div class="flex items-center gap-2"><label class="text-sm font-medium min-w-[52px]">' + d.l + '</label>' +
        '<input type="time" id="st-' + d.k + '" value="' + (d.k==='sat'||d.k==='sun' ? '00:00' : '18:00') + '" class="px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>';
    }).join('');

    $('btn-save-set').onclick = async function() {
      var settings = days.map(function(d){
        return { key: 'base_clock_out_' + d.k, value: $('st-'+d.k).value };
      });
      var r = await API.updateSettings(settings);
      alert(r.success ? '설정이 저장되었습니다.' : '실패: ' + r.error);
    };
  }
};

function $(id) { return document.getElementById(id); }

document.addEventListener('DOMContentLoaded', function() { Admin.init(); });
