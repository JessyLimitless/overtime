/**
 * ClockOut.gs - 퇴근 기록
 * 현재 상태 조회, 퇴근 확정, 시간외근무 자동 산출
 */

/* ── 현재 상태 조회 ── */

function getCurrentStatus(params) {
  var session = verifySession(params.session_token);
  if (!session.success) return session;

  var emp   = session.employee;
  var now   = new Date();
  var today = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  var dow   = getDayOfWeekKR(now);

  // 오늘 기록 확인
  var recSheet = getSheet('퇴근기록');
  var recs     = recSheet.getDataRange().getValues();
  var todayRec = null;

  for (var i = 1; i < recs.length; i++) {
    if (String(recs[i][1]) === String(emp.employee_id)) {
      var rd = Utilities.formatDate(new Date(recs[i][2]), 'Asia/Seoul', 'yyyy-MM-dd');
      if (rd === today) {
        todayRec = {
          clock_out_time: Utilities.formatDate(new Date(recs[i][3]), 'Asia/Seoul', 'HH:mm:ss'),
          overtime_minutes: recs[i][5],
          overtime_hours: recs[i][6]
        };
        break;
      }
    }
  }

  var baseClock = getBaseClockOut(now);

  return {
    success: true,
    employee: emp,
    current_time: Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    day_of_week: dow,
    base_clock_out: baseClock,
    today_record: todayRec,
    already_recorded: todayRec !== null
  };
}

/* ── 퇴근 확정 ── */

function handleClockOut(params) {
  var session = verifySession(params.session_token);
  if (!session.success) return session;

  var emp   = session.employee;
  var now   = new Date();
  var today = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');

  // 중복 방지
  var recSheet = getSheet('퇴근기록');
  var recs     = recSheet.getDataRange().getValues();
  for (var i = 1; i < recs.length; i++) {
    if (String(recs[i][1]) === String(emp.employee_id)) {
      var rd = Utilities.formatDate(new Date(recs[i][2]), 'Asia/Seoul', 'yyyy-MM-dd');
      if (rd === today) return { success: false, error: '오늘 이미 퇴근 기록이 있습니다.' };
    }
  }

  // GPS
  var gpsEnabled = getSettingValue('gps_enabled') === 'true';
  var gpsLat = null, gpsLng = null, gpsVerified = true;
  if (gpsEnabled && params.latitude && params.longitude) {
    gpsLat = parseFloat(params.latitude);
    gpsLng = parseFloat(params.longitude);
    gpsVerified = verifyGPS(gpsLat, gpsLng);
  }

  // 시간외근무 산출
  var baseClock = getBaseClockOut(now);
  var otMin  = calculateOvertime(now, baseClock);
  var otHour = Math.round((otMin / 60) * 100) / 100;

  var recordId = 'REC_' + Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd') + '_' + emp.employee_id;
  var dow = getDayOfWeekKR(now);

  recSheet.appendRow([
    recordId, emp.employee_id, now, now, baseClock,
    otMin, otHour, gpsLat, gpsLng, gpsVerified,
    dow, now, ''
  ]);

  // 월별 통계 갱신
  updateMonthlyStats(emp.employee_id, now);

  return {
    success: true,
    record: {
      record_id: recordId,
      clock_out_time: Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
      base_clock_out: baseClock,
      overtime_minutes: otMin,
      overtime_hours: otHour,
      gps_verified: gpsVerified
    }
  };
}

/* ── 헬퍼 ── */

function getBaseClockOut(date) {
  var keys = ['sun','mon','tue','wed','thu','fri','sat'];
  return getSettingValue('base_clock_out_' + keys[date.getDay()]) || '18:00';
}

function calculateOvertime(actual, baseClock) {
  var parts = baseClock.split(':');
  var baseMin   = Number(parts[0]) * 60 + Number(parts[1]);
  var actualMin = actual.getHours() * 60 + actual.getMinutes();
  var diff = actualMin - baseMin;
  return diff > 0 ? diff : 0;
}

function getDayOfWeekKR(d) {
  return ['일','월','화','수','목','금','토'][d.getDay()];
}
