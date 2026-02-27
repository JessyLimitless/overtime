/**
 * Code.gs - 메인 엔트리포인트
 * doGet / doPost 라우터
 */

var SPREADSHEET_ID = '1DwKgQ6lsukXQyUM0u8N4oIjDFcHPyyLJgCrg7Lg2fM4';

/* ── Web App 핸들러 ── */

function doGet(e)  { return _route(e, 'GET');  }
function doPost(e) { return _route(e, 'POST'); }

function _route(e, method) {
  var params;
  try {
    if (method === 'POST' && e.postData) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter || {};
    }
  } catch (err) {
    return _json({ success: false, error: '요청 파싱 오류: ' + err.message });
  }

  var action = params.action || '';
  var result;

  try {
    switch (action) {
      // ── 인증 ──
      case 'login':              result = handleLogin(params);          break;
      case 'verify_session':     result = verifySession(params.session_token); break;

      // ── 퇴근 ──
      case 'clock_out':          result = handleClockOut(params);       break;
      case 'get_current_status': result = getCurrentStatus(params);     break;

      // ── 기록 조회 ──
      case 'get_records':        result = getRecords(params);           break;
      case 'get_monthly_summary':result = getMonthlySummary(params);    break;

      // ── 관리자 ──
      case 'admin_login':        result = handleAdminLogin(params);     break;
      case 'get_all_stats':      result = getAllStats(params);           break;
      case 'get_dashboard_data': result = getDashboardData(params);     break;
      case 'generate_qr':        result = generateQR(params);           break;
      case 'generate_all_qr':    result = generateAllQR(params);        break;
      case 'add_employee':       result = addEmployee(params);          break;
      case 'get_employees':      result = getEmployees(params);         break;
      case 'update_settings':    result = updateSettings(params);       break;
      case 'get_settings':       result = getSettings(params);          break;

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.message };
    Logger.log('ERROR [' + action + ']: ' + error.message);
  }

  return _json(result);
}

/* ── 공통 헬퍼 ── */

function getSheet(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('시트를 찾을 수 없습니다: ' + name);
  return sh;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
