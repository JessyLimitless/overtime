/**
 * Records.gs - 기록 조회 & 월별 통계
 * 개인 기록 조회, 월별 요약, 통계 자동 갱신
 */

/* ── 개인 기록 조회 ── */

function getRecords(params) {
  var session = verifySession(params.session_token);
  if (!session.success) return session;

  var empId = session.employee.employee_id;
  var year  = Number(params.year) || new Date().getFullYear();

  var data    = getSheet('퇴근기록').getDataRange().getValues();
  var records = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== String(empId)) continue;
    var rd = new Date(data[i][2]);
    if (rd.getFullYear() !== year) continue;

    records.push({
      record_id:       data[i][0],
      record_date:     Utilities.formatDate(rd, 'Asia/Seoul', 'yyyy-MM-dd'),
      clock_out_time:  Utilities.formatDate(new Date(data[i][3]), 'Asia/Seoul', 'HH:mm'),
      base_clock_out:  data[i][4],
      overtime_minutes: data[i][5],
      overtime_hours:  data[i][6],
      day_of_week:     data[i][10],
      gps_verified:    data[i][9]
    });
  }

  records.sort(function (a, b) { return new Date(b.record_date) - new Date(a.record_date); });

  // 월별 소계
  var monthly = {};
  records.forEach(function (r) {
    var m = r.record_date.substring(0, 7);
    if (!monthly[m]) monthly[m] = { total_minutes: 0, count: 0 };
    monthly[m].total_minutes += r.overtime_minutes;
    monthly[m].count += 1;
  });

  return { success: true, year: year, records: records, monthly_summary: monthly, total_records: records.length };
}

/* ── 월별 요약 ── */

function getMonthlySummary(params) {
  var session = verifySession(params.session_token);
  if (!session.success) return session;

  var empId = session.employee.employee_id;
  var year  = String(params.year || new Date().getFullYear());

  var data = getSheet('시간외근무_월별통계').getDataRange().getValues();
  var out  = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== String(empId)) continue;
    if (!String(data[i][4]).startsWith(year)) continue;
    out.push({
      year_month: data[i][4],
      total_overtime_minutes: data[i][5],
      total_overtime_hours:   data[i][6],
      work_days_count:        data[i][7],
      overtime_days_count:    data[i][8],
      avg_overtime_minutes:   data[i][9]
    });
  }
  out.sort(function (a, b) { return b.year_month.localeCompare(a.year_month); });

  return { success: true, year: year, summaries: out };
}

/* ── 월별 통계 갱신 (퇴근 기록 시 자동 호출) ── */

function updateMonthlyStats(employeeId, date) {
  var ym     = Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM');
  var statId = 'STAT_' + ym.replace('-', '') + '_' + employeeId;

  var recData = getSheet('퇴근기록').getDataRange().getValues();
  var totalMin = 0, workDays = 0, otDays = 0, maxMin = 0, maxDate = '';

  for (var i = 1; i < recData.length; i++) {
    if (String(recData[i][1]) !== String(employeeId)) continue;
    var rym = Utilities.formatDate(new Date(recData[i][2]), 'Asia/Seoul', 'yyyy-MM');
    if (rym !== ym) continue;

    workDays++;
    var min = recData[i][5] || 0;
    totalMin += min;
    if (min > 0) otDays++;
    if (min > maxMin) {
      maxMin  = min;
      maxDate = Utilities.formatDate(new Date(recData[i][2]), 'Asia/Seoul', 'yyyy-MM-dd');
    }
  }

  // 직원 정보
  var empData = getSheet('직원마스터').getDataRange().getValues();
  var empName = '', empDept = '';
  for (var i = 1; i < empData.length; i++) {
    if (String(empData[i][0]) === String(employeeId)) {
      empName = empData[i][1];
      empDept = empData[i][2];
      break;
    }
  }

  var totalH = Math.round((totalMin / 60) * 100) / 100;
  var avgMin = workDays > 0 ? Math.round(totalMin / workDays) : 0;

  // upsert
  var sSheet = getSheet('시간외근무_월별통계');
  var sData  = sSheet.getDataRange().getValues();
  var found  = false;

  for (var i = 1; i < sData.length; i++) {
    if (String(sData[i][0]) === statId) {
      var row = i + 1;
      sSheet.getRange(row, 6).setValue(totalMin);
      sSheet.getRange(row, 7).setValue(totalH);
      sSheet.getRange(row, 8).setValue(workDays);
      sSheet.getRange(row, 9).setValue(otDays);
      sSheet.getRange(row, 10).setValue(avgMin);
      sSheet.getRange(row, 11).setValue(maxDate);
      sSheet.getRange(row, 12).setValue(maxMin);
      found = true;
      break;
    }
  }

  if (!found) {
    sSheet.appendRow([statId, employeeId, empName, empDept, ym,
      totalMin, totalH, workDays, otDays, avgMin, maxDate, maxMin]);
  }
}
