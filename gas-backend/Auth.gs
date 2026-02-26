/**
 * Auth.gs - 인증 모듈
 * SHA-256 해시, 세션 관리, 로그인 처리
 */

/* ── 유틸 ── */

function hashPassword(password) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    password, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function generateToken(prefix) {
  var ts  = new Date().getTime();
  var rnd = Math.random().toString(36).substring(2, 15);
  var src = prefix + '_' + ts + '_' + rnd;
  var dig = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, src);
  return prefix + '_' + dig.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('').substring(0, 16);
}

function getSettingValue(key) {
  var sheet = getSheet('설정');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

/* ── 로그인 ── */

function handleLogin(params) {
  var employee_id  = params.employee_id;
  var password     = params.password;
  var unique_token = params.unique_token;

  var sheet = getSheet('직원마스터');
  var data  = sheet.getDataRange().getValues();

  var targetRow   = null;
  var targetIndex = -1;

  // QR 토큰 로그인
  if (unique_token) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][5]) === String(unique_token) && data[i][7] === true) {
        targetRow = data[i];
        targetIndex = i;
        break;
      }
    }
    if (!targetRow) return { success: false, error: '유효하지 않은 접속 링크입니다.' };
  }

  // 사번 + 비밀번호 로그인
  if (!targetRow && employee_id && password) {
    var ph = hashPassword(password);
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(employee_id) &&
          String(data[i][4]) === ph &&
          data[i][7] === true) {
        targetRow = data[i];
        targetIndex = i;
        break;
      }
    }
    if (!targetRow) return { success: false, error: '사번 또는 비밀번호가 올바르지 않습니다.' };
  }

  if (!targetRow) return { success: false, error: '인증 정보가 필요합니다.' };

  // 세션 생성
  var sessionToken = generateToken('ses');
  var now = new Date();
  var expHours = Number(getSettingValue('session_expire_hours')) || 24;
  var expiresAt = new Date(now.getTime() + expHours * 3600000);

  getSheet('세션').appendRow([sessionToken, targetRow[0], now, expiresAt, true]);

  // last_login 업데이트
  sheet.getRange(targetIndex + 1, 10).setValue(now);

  return {
    success: true,
    session_token: sessionToken,
    employee: {
      employee_id: targetRow[0],
      name: targetRow[1],
      department: targetRow[2],
      position: targetRow[3]
    }
  };
}

/* ── 세션 검증 ── */

function verifySession(sessionToken) {
  if (!sessionToken) return { success: false, error: '세션 토큰이 필요합니다.' };

  var sheet = getSheet('세션');
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(sessionToken) && data[i][4] === true) {
      if (now < new Date(data[i][3])) {
        // ADMIN 세션
        if (data[i][1] === 'ADMIN') {
          return { success: true, employee: { employee_id: 'ADMIN', name: '관리자', department: '관리', position: '' } };
        }
        // 일반 직원 세션
        var empSheet = getSheet('직원마스터');
        var empData  = empSheet.getDataRange().getValues();
        for (var j = 1; j < empData.length; j++) {
          if (String(empData[j][0]) === String(data[i][1])) {
            return {
              success: true,
              employee: {
                employee_id: empData[j][0],
                name: empData[j][1],
                department: empData[j][2],
                position: empData[j][3]
              }
            };
          }
        }
      } else {
        sheet.getRange(i + 1, 5).setValue(false);
      }
    }
  }
  return { success: false, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
}
