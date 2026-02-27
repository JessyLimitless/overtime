/**
 * Admin.gs - 관리자 기능
 * 로그인 · 대시보드 · QR 생성 · 직원 관리 · 설정
 */

/* ═══════ 관리자 로그인 ═══════ */

function handleAdminLogin(p) {
  var stored = getSettingValue('admin_password_hash');
  if (hashPassword(p.password || '') !== stored)
    return { success:false, error:'관리자 비밀번호가 올바르지 않습니다.' };

  var tok = generateToken('adm');
  var now = new Date();
  getSheet('세션').appendRow([tok, 'ADMIN', now, new Date(now.getTime() + 8*3600000), true]);
  _log('LOGIN', '-', '관리자 로그인');
  return { success:true, session_token:tok, role:'admin' };
}

/* ═══════ 전체 통계 ═══════ */

function getAllStats(p) {
  var s = verifySession(p.session_token); if (!s.success) return s;
  var ym = p.year_month;
  var rows = getSheet('시간외근무_월별통계').getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (ym && rows[i][4] !== ym) continue;
    out.push({
      employee_id:rows[i][1], name:rows[i][2], department:rows[i][3],
      year_month:rows[i][4], total_overtime_hours:rows[i][6],
      work_days:rows[i][7], overtime_days:rows[i][8], avg_overtime_minutes:rows[i][9]
    });
  }
  return { success:true, stats:out };
}

/* ═══════ 대시보드 ═══════ */

function getDashboardData(p) {
  var s = verifySession(p.session_token); if (!s.success) return s;
  var ym = p.year_month || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  var rows = getSheet('시간외근무_월별통계').getDataRange().getValues();

  var dept = {}, personal = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][4] !== ym) continue;
    var d = rows[i][3];
    if (!dept[d]) dept[d] = { h:0, n:0 };
    dept[d].h += rows[i][6]; dept[d].n++;
    personal.push({ name:rows[i][2], department:d, total_hours:rows[i][6], overtime_days:rows[i][8] });
  }

  var deptArr = [];
  for (var k in dept) {
    deptArr.push({ department:k, total_hours:_r2(dept[k].h), avg_hours:_r2(dept[k].h/dept[k].n), employee_count:dept[k].n });
  }
  personal.sort(function(a,b){ return b.total_hours - a.total_hours; });

  return {
    success:true, year_month:ym,
    department_summary: deptArr,
    top_overtime_employees: personal.slice(0,10),
    weekly_trend: _weekTrend(ym),
    total_employees: personal.length
  };
}

function _weekTrend(ym) {
  var rows = getSheet('퇴근기록').getDataRange().getValues();
  var w = {};
  for (var i = 1; i < rows.length; i++) {
    var d = new Date(rows[i][2]);
    if (Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM') !== ym) continue;
    var wn = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
    var key = ym + '-W' + wn;
    if (!w[key]) w[key] = { m:0, c:0 };
    w[key].m += (rows[i][5]||0); w[key].c++;
  }
  var out = [];
  for (var k in w) out.push({ week:k, total_hours:_r2(w[k].m/60), record_count:w[k].c });
  return out;
}

/* ═══════ QR 일괄 생성 ═══════ */

function generateAllQR(p) {
  var s = verifySession(p.session_token); if (!s.success) return s;
  var base = p.base_url || 'https://your-app.netlify.app';
  var sh = getSheet('직원마스터');
  var rows = sh.getDataRange().getValues();
  var res = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][7] !== true) continue;
    var tk = rows[i][5] || generateToken('tk');
    if (!rows[i][5]) sh.getRange(i+1, 6).setValue(tk);
    var url = base + '/?t=' + tk;
    sh.getRange(i+1, 7).setValue(url);
    res.push({ employee_id:rows[i][0], name:rows[i][1], department:rows[i][2], qr_url:url });
  }
  _log('QR_ALL', '-', res.length + '명');
  return { success:true, results:res, count:res.length };
}

/* ═══════ 단일 QR ═══════ */

function generateQR(p) {
  var s = verifySession(p.session_token); if (!s.success) return s;
  var base = p.base_url || 'https://your-app.netlify.app';
  var sh = getSheet('직원마스터');
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(p.employee_id)) {
      var tk = generateToken('tk');
      var url = base + '/?t=' + tk;
      sh.getRange(i+1,6).setValue(tk);
      sh.getRange(i+1,7).setValue(url);
      _log('QR', p.employee_id, 'QR 재생성');
      return { success:true, employee_id:p.employee_id, qr_url:url };
    }
  }
  return { success:false, error:'직원을 찾을 수 없습니다.' };
}

/* ═══════ 직원 추가 ═══════ */

function addEmployee(p) {
  var s = verifySession(p.session_token); if (!s.success) return s;
  var base = p.base_url || 'https://your-app.netlify.app';
  var tk = generateToken('tk');
  var url = base + '/?t=' + tk;
  getSheet('직원마스터').appendRow([
    p.employee_id, p.name, p.department, p.position||'',
    hashPassword(p.initial_password||'0000'), tk, url, true, new Date(), ''
  ]);
  _log('ADD_EMP', p.employee_id, p.name);
  return { success:true, employee_id:p.employee_id, qr_url:url };
}

/* ═══════ 직원 목록 ═══════ */

function getEmployees(p) {
  var s = verifySession(p.session_token); if (!s.success) return s;
  var rows = getSheet('직원마스터').getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    list.push({
      employee_id:rows[i][0], name:rows[i][1], department:rows[i][2],
      position:rows[i][3], is_active:rows[i][7], qr_url:rows[i][6]
    });
  }
  return { success:true, employees:list };
}

/* ═══════ 설정 ═══════ */

function updateSettings(p) {
  var s = verifySession(p.session_token); if (!s.success) return s;
  var sh = getSheet('설정');
  var rows = sh.getDataRange().getValues();
  var now = new Date();
  (p.settings || []).forEach(function(u) {
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === u.key) {
        sh.getRange(i+1,2).setValue(u.value);
        sh.getRange(i+1,4).setValue(now);
        found = true; break;
      }
    }
    if (!found) sh.appendRow([u.key, u.value, '', now]);
  });
  _log('SETTINGS', '-', (p.settings||[]).length + '개 변경');
  return { success:true, message:'설정이 저장되었습니다.' };
}

function getSettings(p) {
  var s = verifySession(p.session_token); if (!s.success) return s;
  var rows = getSheet('설정').getDataRange().getValues();
  var obj = {};
  for (var i = 1; i < rows.length; i++) obj[rows[i][0]] = rows[i][1];
  return { success:true, settings:obj };
}

/* ═══════ 내부 ═══════ */

function _log(action, target, detail) {
  var now = new Date();
  getSheet('관리자_로그').appendRow([
    'LOG_' + Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd_HHmmss'),
    action, target, detail, now
  ]);
}

function _r2(n) { return Math.round(n * 100) / 100; }
