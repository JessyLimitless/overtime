/**
 * Admin.gs - 관리자 기능
 * 로그인, 대시보드 데이터, QR 생성, 직원 관리, 설정
 */

/* ── 관리자 로그인 ── */

function handleAdminLogin(params) {
  var adminHash = getSettingValue('admin_password_hash');
  var inputHash = hashPassword(params.password || '');

  if (inputHash !== adminHash) {
    return { success: false, error: '관리자 비밀번호가 올바르지 않습니다.' };
  }

  var token     = generateToken('adm');
  var now       = new Date();
  var expiresAt = new Date(now.getTime() + 8 * 3600000);

  getSheet('세션').appendRow([token, 'ADMIN', now, expiresAt, true]);
  _logAdmin('LOGIN', '-', '관리자 로그인');

  return { success: true, session_token: token, role: 'admin' };
}

/* ── 전체 통계 ── */

function getAllStats(params) {
  var s = verifySession(params.session_token);
  if (!s.success) return s;

  var ym   = params.year_month;
  var data = getSheet('시간외근무_월별통계').getDataRange().getValues();
  var out  = [];

  for (var i = 1; i < data.length; i++) {
    if (ym && data[i][4] !== ym) continue;
    out.push({
      employee_id: data[i][1], name: data[i][2], department: data[i][3],
      year_month: data[i][4], total_overtime_hours: data[i][6],
      work_days: data[i][7], overtime_days: data[i][8], avg_overtime_minutes: data[i][9]
    });
  }
  return { success: true, stats: out };
}

/* ── 대시보드 ── */

function getDashboardData(params) {
  var s = verifySession(params.session_token);
  if (!s.success) return s;

  var ym = params.year_month || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  var data = getSheet('시간외근무_월별통계').getDataRange().getValues();

  var deptMap = {};
  var personal = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][4] !== ym) continue;
    var dept = data[i][3];
    if (!deptMap[dept]) deptMap[dept] = { total_hours: 0, count: 0 };
    deptMap[dept].total_hours += data[i][6];
    deptMap[dept].count += 1;
    personal.push({ name: data[i][2], department: dept, total_hours: data[i][6], overtime_days: data[i][8] });
  }

  var deptSummary = [];
  for (var d in deptMap) {
    deptSummary.push({
      department: d,
      total_hours: Math.round(deptMap[d].total_hours * 100) / 100,
      avg_hours: Math.round((deptMap[d].total_hours / deptMap[d].count) * 100) / 100,
      employee_count: deptMap[d].count
    });
  }

  personal.sort(function (a, b) { return b.total_hours - a.total_hours; });

  return {
    success: true,
    year_month: ym,
    department_summary: deptSummary,
    top_overtime_employees: personal.slice(0, 10),
    weekly_trend: _getWeeklyTrend(ym),
    total_employees: personal.length
  };
}

function _getWeeklyTrend(ym) {
  var data = getSheet('퇴근기록').getDataRange().getValues();
  var weeks = {};
  for (var i = 1; i < data.length; i++) {
    var rd  = new Date(data[i][2]);
    var rym = Utilities.formatDate(rd, 'Asia/Seoul', 'yyyy-MM');
    if (rym !== ym) continue;
    var wn  = Math.ceil((rd.getDate() + new Date(rd.getFullYear(), rd.getMonth(), 1).getDay()) / 7);
    var key = ym + '-W' + wn;
    if (!weeks[key]) weeks[key] = { total_minutes: 0, count: 0 };
    weeks[key].total_minutes += (data[i][5] || 0);
    weeks[key].count += 1;
  }
  var out = [];
  for (var w in weeks) {
    out.push({ week: w, total_hours: Math.round((weeks[w].total_minutes / 60) * 100) / 100, record_count: weeks[w].count });
  }
  return out;
}

/* ── QR 일괄 생성 ── */

function generateAllQR(params) {
  var s = verifySession(params.session_token);
  if (!s.success) return s;

  var baseUrl = params.base_url || 'https://your-app.netlify.app';
  var sheet   = getSheet('직원마스터');
  var data    = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][7] !== true) continue;
    var token = data[i][5];
    if (!token) { token = generateToken('tk'); sheet.getRange(i + 1, 6).setValue(token); }
    var url = baseUrl + '/?t=' + token;
    sheet.getRange(i + 1, 7).setValue(url);
    results.push({ employee_id: data[i][0], name: data[i][1], department: data[i][2], qr_url: url, token: token });
  }

  _logAdmin('QR_GENERATE_ALL', '-', results.length + '명 QR 생성');
  return { success: true, results: results, count: results.length };
}

/* ── 단일 QR 생성 ── */

function generateQR(params) {
  var s = verifySession(params.session_token);
  if (!s.success) return s;

  var baseUrl = params.base_url || 'https://your-app.netlify.app';
  var sheet   = getSheet('직원마스터');
  var data    = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.employee_id)) {
      var token = generateToken('tk');
      var url   = baseUrl + '/?t=' + token;
      sheet.getRange(i + 1, 6).setValue(token);
      sheet.getRange(i + 1, 7).setValue(url);
      _logAdmin('QR_GENERATE', params.employee_id, 'QR 재생성');
      return { success: true, employee_id: params.employee_id, qr_url: url, token: token };
    }
  }
  return { success: false, error: '직원을 찾을 수 없습니다.' };
}

/* ── 직원 추가 ── */

function addEmployee(params) {
  var s = verifySession(params.session_token);
  if (!s.success) return s;

  var sheet   = getSheet('직원마스터');
  var baseUrl = params.base_url || 'https://your-app.netlify.app';
  var token   = generateToken('tk');
  var url     = baseUrl + '/?t=' + token;
  var now     = new Date();

  sheet.appendRow([
    params.employee_id, params.name, params.department, params.position || '',
    hashPassword(params.initial_password || '0000'),
    token, url, true, now, ''
  ]);

  _logAdmin('EMPLOYEE_ADD', params.employee_id, params.name + ' 추가');
  return { success: true, employee_id: params.employee_id, qr_url: url };
}

/* ── 직원 목록 조회 ── */

function getEmployees(params) {
  var s = verifySession(params.session_token);
  if (!s.success) return s;

  var data = getSheet('직원마스터').getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    list.push({
      employee_id: data[i][0], name: data[i][1], department: data[i][2],
      position: data[i][3], is_active: data[i][7],
      qr_url: data[i][6], created_at: data[i][8]
    });
  }
  return { success: true, employees: list };
}

/* ── 설정 변경 ── */

function updateSettings(params) {
  var s = verifySession(params.session_token);
  if (!s.success) return s;

  var sheet   = getSheet('설정');
  var data    = sheet.getDataRange().getValues();
  var now     = new Date();
  var updates = params.settings; // [{key, value}]

  updates.forEach(function (u) {
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === u.key) {
        sheet.getRange(i + 1, 2).setValue(u.value);
        sheet.getRange(i + 1, 4).setValue(now);
        found = true; break;
      }
    }
    if (!found) sheet.appendRow([u.key, u.value, u.description || '', now]);
  });

  _logAdmin('SETTINGS_UPDATE', '-', updates.length + '개 설정 변경');
  return { success: true, message: '설정이 업데이트되었습니다.' };
}

/* ── 관리자 로그 ── */

function _logAdmin(action, target, details) {
  var now = new Date();
  var id  = 'LOG_' + Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd_HHmmss');
  getSheet('관리자_로그').appendRow([id, action, target, details, now]);
}
