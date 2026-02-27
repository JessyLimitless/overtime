/**
 * ClockOut.gs - 퇴근 기록
 * 현재 상태 조회 · 퇴근 확정 · 시간외근무 자동 산출
 */

/* ═══════ 현재 상태 ═══════ */

function getCurrentStatus(p) {
  var s = verifySession(p.session_token);
  if (!s.success) return s;

  var emp   = s.employee;
  var now   = new Date();
  var today = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  var dow   = _dayKR(now);

  // 오늘 기록 확인
  var rows = getSheet('퇴근기록').getDataRange().getValues();
  var todayRec = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== String(emp.employee_id)) continue;
    var rd = Utilities.formatDate(new Date(rows[i][2]), 'Asia/Seoul', 'yyyy-MM-dd');
    if (rd === today) {
      todayRec = {
        clock_out_time: Utilities.formatDate(new Date(rows[i][3]), 'Asia/Seoul', 'HH:mm:ss'),
        overtime_minutes: rows[i][5],
        overtime_hours: rows[i][6]
      };
      break;
    }
  }

  return {
    success: true,
    employee: emp,
    current_time: Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    day_of_week: dow,
    base_clock_out: _baseClock(now),
    today_record: todayRec,
    already_recorded: todayRec !== null
  };
}

/* ═══════ 퇴근 확정 ═══════ */

function handleClockOut(p) {
  var s = verifySession(p.session_token);
  if (!s.success) return s;

  var emp   = s.employee;
  var now   = new Date();
  var today = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');

  // 중복 체크
  var sheet = getSheet('퇴근기록');
  var rows  = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== String(emp.employee_id)) continue;
    var rd = Utilities.formatDate(new Date(rows[i][2]), 'Asia/Seoul', 'yyyy-MM-dd');
    if (rd === today) return { success: false, error: '오늘 이미 퇴근 기록이 있습니다.' };
  }

  // GPS
  var gpsOn = getSettingValue('gps_enabled') === 'true';
  var lat = null, lng = null, gpsOk = true;
  if (gpsOn && p.latitude != null && p.longitude != null) {
    lat = parseFloat(p.latitude);
    lng = parseFloat(p.longitude);
    gpsOk = verifyGPS(lat, lng);
  }

  // 시간외근무
  var base  = _baseClock(now);
  var otMin = _calcOT(now, base);
  var otH   = Math.round(otMin / 60 * 100) / 100;

  var recId = 'REC_' + Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd') + '_' + emp.employee_id;

  sheet.appendRow([
    recId, emp.employee_id, now, now, base,
    otMin, otH, lat, lng, gpsOk,
    _dayKR(now), now, ''
  ]);

  // 월별 통계
  updateMonthlyStats(emp.employee_id, now);

  return {
    success: true,
    record: {
      record_id: recId,
      clock_out_time: Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
      base_clock_out: base,
      overtime_minutes: otMin,
      overtime_hours: otH,
      gps_verified: gpsOk
    }
  };
}

/* ═══════ 내부 헬퍼 ═══════ */

function _baseClock(d) {
  var k = ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()];
  return getSettingValue('base_clock_out_' + k) || '18:00';
}

function _calcOT(actual, base) {
  var bp = base.split(':');
  var bm = Number(bp[0]) * 60 + Number(bp[1]);
  var am = actual.getHours() * 60 + actual.getMinutes();
  return am > bm ? am - bm : 0;
}

function _dayKR(d) {
  return ['일','월','화','수','목','금','토'][d.getDay()];
}
