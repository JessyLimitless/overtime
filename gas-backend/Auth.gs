/**
 * Auth.gs - 인증 모듈
 * SHA-256 해시 · 토큰 생성 · 로그인 · 세션 검증
 */

/* ═══════ 유틸 ═══════ */

function hashPassword(pw) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw, Utilities.Charset.UTF_8);
  return d.map(function(b){ return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function generateToken(prefix) {
  var src = prefix + '_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2,12);
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, src);
  return prefix + '_' + d.map(function(b){ return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('').substr(0,16);
}

function getSettingValue(key) {
  var sh = getSheet('설정');
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) {
      var v = rows[i][1];
      // Google Sheets가 "18:00" 같은 시간값을 Date 객체로 자동 변환하는 문제 처리
      if (v instanceof Date) {
        return Utilities.formatDate(v, 'Asia/Seoul', 'HH:mm');
      }
      return String(v);
    }
  }
  return null;
}

/* ═══════ 로그인 ═══════ */

function handleLogin(p) {
  var sheet = getSheet('직원마스터');
  var rows  = sheet.getDataRange().getValues();
  var target = null, idx = -1;

  // 1) QR 토큰 로그인
  if (p.unique_token) {
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][5]) === String(p.unique_token) && rows[i][7] === true) {
        target = rows[i]; idx = i; break;
      }
    }
    if (!target) return { success: false, error: '유효하지 않은 접속 링크입니다.' };
  }

  // 2) 사번 + 비밀번호 로그인
  if (!target && p.employee_id && p.password) {
    var hash = hashPassword(p.password);
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(p.employee_id) &&
          String(rows[i][4]) === hash &&
          rows[i][7] === true) {
        target = rows[i]; idx = i; break;
      }
    }
    if (!target) return { success: false, error: '사번 또는 비밀번호가 올바르지 않습니다.' };
  }

  if (!target) return { success: false, error: '인증 정보가 필요합니다.' };

  // 세션 생성
  var tok = generateToken('ses');
  var now = new Date();
  var hrs = Number(getSettingValue('session_expire_hours')) || 24;
  var exp = new Date(now.getTime() + hrs * 3600000);
  getSheet('세션').appendRow([tok, target[0], now, exp, true]);

  // last_login 갱신
  sheet.getRange(idx + 1, 10).setValue(now);

  return {
    success: true,
    session_token: tok,
    employee: { employee_id: target[0], name: target[1], department: target[2], position: target[3] }
  };
}

/* ═══════ 세션 검증 ═══════ */

function verifySession(token) {
  if (!token) return { success: false, error: '세션 토큰이 필요합니다.' };

  var sh   = getSheet('세션');
  var rows = sh.getDataRange().getValues();
  var now  = new Date();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(token)) continue;
    if (rows[i][4] !== true) continue;

    if (now >= new Date(rows[i][3])) {
      sh.getRange(i + 1, 5).setValue(false); // 만료
      continue;
    }

    var empId = rows[i][1];

    // 관리자 세션
    if (empId === 'ADMIN') {
      return { success: true, employee: { employee_id:'ADMIN', name:'관리자', department:'관리', position:'' }, role:'admin' };
    }

    // 직원 조회
    var empRows = getSheet('직원마스터').getDataRange().getValues();
    for (var j = 1; j < empRows.length; j++) {
      if (String(empRows[j][0]) === String(empId)) {
        return {
          success: true,
          employee: { employee_id: empRows[j][0], name: empRows[j][1], department: empRows[j][2], position: empRows[j][3] }
        };
      }
    }
  }

  return { success: false, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
}
