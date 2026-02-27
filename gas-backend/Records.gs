/**
 * Records.gs - 기록 조회 & 월별 통계
 */

/* ═══════ 개인 기록 조회 ═══════ */

function getRecords(p) {
  var s = verifySession(p.session_token);
  if (!s.success) return s;

  var eid  = s.employee.employee_id;
  var year = Number(p.year) || new Date().getFullYear();
  var rows = getSheet('퇴근기록').getDataRange().getValues();
  var list = [];

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== String(eid)) continue;
    var d = new Date(rows[i][2]);
    if (d.getFullYear() !== year) continue;
    list.push({
      record_id:        rows[i][0],
      record_date:      Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd'),
      clock_out_time:   Utilities.formatDate(new Date(rows[i][3]), 'Asia/Seoul', 'HH:mm'),
      base_clock_out:   rows[i][4],
      overtime_minutes: rows[i][5],
      overtime_hours:   rows[i][6],
      day_of_week:      rows[i][10],
      gps_verified:     rows[i][9]
    });
  }

  list.sort(function(a,b){ return b.record_date.localeCompare(a.record_date); });

  // 월별 소계
  var monthly = {};
  list.forEach(function(r){
    var m = r.record_date.substring(0,7);
    if (!monthly[m]) monthly[m] = { total_minutes:0, count:0 };
    monthly[m].total_minutes += (r.overtime_minutes || 0);
    monthly[m].count++;
  });

  return { success:true, year:year, records:list, monthly_summary:monthly, total_records:list.length };
}

/* ═══════ 월별 요약 ═══════ */

function getMonthlySummary(p) {
  var s = verifySession(p.session_token);
  if (!s.success) return s;

  var eid  = String(s.employee.employee_id);
  var year = String(p.year || new Date().getFullYear());
  var rows = getSheet('시간외근무_월별통계').getDataRange().getValues();
  var out  = [];

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== eid) continue;
    if (String(rows[i][4]).indexOf(year) !== 0) continue;
    out.push({
      year_month:             rows[i][4],
      total_overtime_minutes: rows[i][5],
      total_overtime_hours:   rows[i][6],
      work_days_count:        rows[i][7],
      overtime_days_count:    rows[i][8],
      avg_overtime_minutes:   rows[i][9]
    });
  }
  out.sort(function(a,b){ return b.year_month.localeCompare(a.year_month); });
  return { success:true, year:year, summaries:out };
}

/* ═══════ 월별 통계 갱신 (내부) ═══════ */

function updateMonthlyStats(eid, date) {
  var ym = Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM');
  var sid = 'STAT_' + ym.replace('-','') + '_' + eid;

  // 해당 월 기록 집계
  var recs = getSheet('퇴근기록').getDataRange().getValues();
  var totMin=0, wDays=0, otDays=0, maxMin=0, maxDt='';
  for (var i = 1; i < recs.length; i++) {
    if (String(recs[i][1]) !== String(eid)) continue;
    if (Utilities.formatDate(new Date(recs[i][2]), 'Asia/Seoul', 'yyyy-MM') !== ym) continue;
    wDays++;
    var m = recs[i][5] || 0;
    totMin += m;
    if (m > 0) otDays++;
    if (m > maxMin) { maxMin = m; maxDt = Utilities.formatDate(new Date(recs[i][2]), 'Asia/Seoul', 'yyyy-MM-dd'); }
  }

  // 직원 정보
  var emps = getSheet('직원마스터').getDataRange().getValues();
  var nm='', dp='';
  for (var i = 1; i < emps.length; i++) {
    if (String(emps[i][0]) === String(eid)) { nm = emps[i][1]; dp = emps[i][2]; break; }
  }

  var totH = Math.round(totMin / 60 * 100) / 100;
  var avg  = wDays > 0 ? Math.round(totMin / wDays) : 0;

  // upsert
  var ss = getSheet('시간외근무_월별통계');
  var sd = ss.getDataRange().getValues();
  for (var i = 1; i < sd.length; i++) {
    if (String(sd[i][0]) === sid) {
      var r = i + 1;
      ss.getRange(r,6).setValue(totMin);  ss.getRange(r,7).setValue(totH);
      ss.getRange(r,8).setValue(wDays);   ss.getRange(r,9).setValue(otDays);
      ss.getRange(r,10).setValue(avg);    ss.getRange(r,11).setValue(maxDt);
      ss.getRange(r,12).setValue(maxMin);
      return;
    }
  }
  ss.appendRow([sid, eid, nm, dp, ym, totMin, totH, wDays, otDays, avg, maxDt, maxMin]);
}
