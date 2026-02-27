/**
 * Setup.gs - 초기 셋업
 * ★ 최초 1회: initialSetup() 실행 → createTriggers() 실행
 */

function initialSetup() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  /* ── 1. 시트 6개 ── */
  var defs = {
    '직원마스터': ['employee_id','name','department','position','password_hash','unique_token','qr_url','is_active','created_at','last_login'],
    '퇴근기록':   ['record_id','employee_id','record_date','clock_out_time','base_clock_out','overtime_minutes','overtime_hours','gps_lat','gps_lng','gps_verified','day_of_week','created_at','ip_address'],
    '시간외근무_월별통계': ['stat_id','employee_id','name','department','year_month','total_overtime_minutes','total_overtime_hours','work_days_count','overtime_days_count','avg_overtime_minutes','max_overtime_date','max_overtime_minutes'],
    '설정':       ['setting_key','setting_value','description','updated_at'],
    '세션':       ['session_token','employee_id','created_at','expires_at','is_active'],
    '관리자_로그': ['log_id','admin_action','target_employee','details','timestamp']
  };

  for (var name in defs) {
    var h = defs[name];
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1,1,1,h.length).setValues([h]);
    sh.getRange(1,1,1,h.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }

  /* ── 2. 기본 설정 (없을 때만) ── */
  var stSh = ss.getSheetByName('설정');
  if (stSh.getDataRange().getValues().length <= 1) {
    var n = new Date();
    stSh.getRange(2,1,13,4).setValues([
      ['base_clock_out_mon','18:00','월요일 기준 퇴근시간',n],
      ['base_clock_out_tue','18:00','화요일 기준 퇴근시간',n],
      ['base_clock_out_wed','18:00','수요일 기준 퇴근시간',n],
      ['base_clock_out_thu','18:00','목요일 기준 퇴근시간',n],
      ['base_clock_out_fri','18:00','금요일 기준 퇴근시간',n],
      ['base_clock_out_sat','00:00','토요일 (전체 시간 산정)',n],
      ['base_clock_out_sun','00:00','일요일 (전체 시간 산정)',n],
      ['office_lat','37.5172','사무실 위도 (여의도)',n],
      ['office_lng','126.9284','사무실 경도 (여의도)',n],
      ['office_radius_m','500','GPS 반경(m)',n],
      ['gps_enabled','true','GPS 검증 ON/OFF',n],
      ['admin_password_hash', hashPassword('admin1234'), '관리자 비밀번호',n],
      ['session_expire_hours','24','세션 만료(시간)',n]
    ]);
    // setting_value 컬럼을 텍스트 형식으로 강제 (Sheets가 "18:00"을 시간으로 변환하는 것 방지)
    stSh.getRange(2, 2, 13, 1).setNumberFormat('@');
  }

  /* ── 3. 테스트 직원 (없을 때만) ── */
  var empSh = ss.getSheetByName('직원마스터');
  if (empSh.getDataRange().getValues().length <= 1) {
    var n2 = new Date();
    empSh.getRange(2,1,4,10).setValues([
      ['1111','테스트사용자','경영지원팀','사원',hashPassword('1111'),generateToken('tk'),'',true,n2,''],
      ['EMP001','홍길동','경영지원팀','대리',hashPassword('1234'),generateToken('tk'),'',true,n2,''],
      ['EMP002','김영희','기업평가1팀','과장',hashPassword('1234'),generateToken('tk'),'',true,n2,''],
      ['EMP003','이철수','기업평가2팀','사원',hashPassword('1234'),generateToken('tk'),'',true,n2,'']
    ]);
  }

  Logger.log('✅ 초기 설정 완료 — 시트 6개 생성, 기본 데이터 삽입');
}

/* ── 테스트 직원 1111 수동 추가 (이미 셋업 완료된 경우 이 함수 실행) ── */

function addTestEmployee1111() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var empSh = ss.getSheetByName('직원마스터');
  var rows = empSh.getDataRange().getValues();

  // 이미 존재하는지 확인
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === '1111') {
      // 비밀번호만 업데이트
      empSh.getRange(i + 1, 5).setValue(hashPassword('1111'));
      empSh.getRange(i + 1, 8).setValue(true);
      Logger.log('직원 1111 비밀번호 업데이트 완료');
      return;
    }
  }

  // 새로 추가
  var n = new Date();
  empSh.appendRow([
    '1111', '테스트사용자', '경영지원팀', '사원',
    hashPassword('1111'), generateToken('tk'), '', true, n, ''
  ]);
  Logger.log('직원 1111 추가 완료 (사번: 1111, 비밀번호: 1111)');
}

/* ── 만료 세션 정리 (트리거) ── */

function cleanupExpiredSessions() {
  var sh = getSheet('세션');
  var rows = sh.getDataRange().getValues();
  var now = new Date();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (now > new Date(rows[i][3])) sh.deleteRow(i + 1);
  }
}

/* ── 트리거 등록 ── */

function createTriggers() {
  ScriptApp.newTrigger('cleanupExpiredSessions')
    .timeBased().everyDays(1).atHour(3).create();
  Logger.log('✅ 트리거 등록 완료 (매일 03시 세션 정리)');
}
