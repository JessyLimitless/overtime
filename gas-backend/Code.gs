/**
 * Code.gs - 메인 엔트리포인트
 * Google Apps Script Web App doGet/doPost 라우터
 */

const SPREADSHEET_ID = '1DwKgQ6lsukXQyUM0u8N4oIjDFcHPyyLJgCrg7Lg2fM4';

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  let params;
  try {
    params = method === 'GET'
      ? e.parameter
      : JSON.parse(e.postData.contents);
  } catch (err) {
    return _json({ success: false, error: '잘못된 요청 형식입니다.' });
  }

  const action = params.action || (e.parameter && e.parameter.action);
  let result;

  try {
    switch (action) {
      /* ── 인증 ── */
      case 'login':            result = handleLogin(params);           break;
      case 'verify_session':   result = verifySession(params.session_token); break;

      /* ── 퇴근 기록 ── */
      case 'clock_out':        result = handleClockOut(params);        break;
      case 'get_current_status': result = getCurrentStatus(params);    break;

      /* ── 기록 조회 ── */
      case 'get_records':      result = getRecords(params);            break;
      case 'get_monthly_summary': result = getMonthlySummary(params);  break;

      /* ── 관리자 ── */
      case 'admin_login':      result = handleAdminLogin(params);      break;
      case 'get_all_stats':    result = getAllStats(params);            break;
      case 'get_dashboard_data': result = getDashboardData(params);    break;
      case 'generate_qr':      result = generateQR(params);            break;
      case 'generate_all_qr':  result = generateAllQR(params);         break;
      case 'add_employee':     result = addEmployee(params);           break;
      case 'update_settings':  result = updateSettings(params);        break;
      case 'get_employees':    result = getEmployees(params);          break;

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }

  return _json(result);
}

/* ── 헬퍼 ── */

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
