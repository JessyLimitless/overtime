/**
 * Setup.gs - 초기 셋업
 * 시트 6개 자동 생성, 기본 설정 데이터, 세션 정리 트리거
 * ★ 최초 1회 initialSetup() 실행 → createTriggers() 실행
 */

function initialSetup() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  /* ── 1. 시트 6개 생성 ── */
  var sheets = {
    '직원마스터': [
      'employee_id','name','department','position','password_hash',
      'unique_token','qr_url','is_active','created_at','last_login'
    ],
    '퇴근기록': [
      'record_id','employee_id','record_date','clock_out_time','base_clock_out',
      'overtime_minutes','overtime_hours','gps_lat','gps_lng','gps_verified',
      'day_of_week','created_at','ip_address'
    ],
    '시간외근무_월별통계': [
      'stat_id','employee_id','name','department','year_month',
      'total_overtime_minutes','total_overtime_hours','work_days_count',
      'overtime_days_count','avg_overtime_minutes','max_overtime_date','max_overtime_minutes'
    ],
    '설정': ['setting_key','setting_value','description','updated_at'],
    '세션': ['session_token','employee_id','created_at','expires_at','is_active'],
    '관리자_로그': ['log_id','admin_action','target_employee','details','timestamp']
  };

  for (var name in sheets) {
    var headers = sheets[name];
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  /* ── 2. 기본 설정 데이터 ── */
  var settingsSheet = ss.getSheetByName('설정');
  var existing = settingsSheet.getDataRange().getValues();

  if (existing.length <= 1) {
    var now = new Date();
    var defaults = [
      ['base_clock_out_mon', '18:00', '월요일 기준 퇴근시간',        now],
      ['base_clock_out_tue', '18:00', '화요일 기준 퇴근시간',        now],
      ['base_clock_out_wed', '18:00', '수요일 기준 퇴근시간',        now],
      ['base_clock_out_thu', '18:00', '목요일 기준 퇴근시간',        now],
      ['base_clock_out_fri', '18:00', '금요일 기준 퇴근시간',        now],
      ['base_clock_out_sat', '00:00', '토요일 (전체 시간 산정)',      now],
      ['base_clock_out_sun', '00:00', '일요일 (전체 시간 산정)',      now],
      ['office_lat',         '37.5172', '사무실 위도 (여의도)',       now],
      ['office_lng',         '126.9284', '사무실 경도 (여의도)',      now],
      ['office_radius_m',    '500',    '사무실 반경(m)',              now],
      ['gps_enabled',        'true',   'GPS 검증 활성화 여부',       now],
      ['admin_password_hash', hashPassword('admin1234'), '관리자 비밀번호 (변경 필요)', now],
      ['session_expire_hours','24',    '세션 만료 시간(시간)',        now]
    ];
    settingsSheet.getRange(2, 1, defaults.length, 4).setValues(defaults);
  }

  /* ── 3. 테스트 직원 (선택) ── */
  var empSheet = ss.getSheetByName('직원마스터');
  var empExist = empSheet.getDataRange().getValues();
  if (empExist.length <= 1) {
    var now2 = new Date();
    var testEmps = [
      ['EMP001','홍길동','경영지원팀','대리', hashPassword('1234'), generateToken('tk'), '', true, now2, ''],
      ['EMP002','김영희','기업평가1팀','과장', hashPassword('1234'), generateToken('tk'), '', true, now2, ''],
      ['EMP003','이철수','기업평가2팀','사원', hashPassword('1234'), generateToken('tk'), '', true, now2, '']
    ];
    empSheet.getRange(2, 1, testEmps.length, 10).setValues(testEmps);
  }

  Logger.log('초기 설정 완료! 시트 6개 생성, 기본 설정 삽입.');
}

/* ── 만료 세션 정리 (매일 자동) ── */

function cleanupExpiredSessions() {
  var sheet = getSheet('세션');
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();

  for (var i = data.length - 1; i >= 1; i--) {
    if (now > new Date(data[i][3])) sheet.deleteRow(i + 1);
  }
}

/* ── 트리거 등록 ── */

function createTriggers() {
  ScriptApp.newTrigger('cleanupExpiredSessions')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log('트리거 등록 완료 (매일 03시 세션 정리)');
}
