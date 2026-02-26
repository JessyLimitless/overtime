/**
 * api.js - Google Apps Script Web App API 통신 모듈
 */

const API_BASE = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

const API = {
  async request(action, params) {
    params = params || {};
    const sessionToken = localStorage.getItem('session_token');
    const body = Object.assign({ action: action, session_token: sessionToken }, params);

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!data.success && data.error && data.error.indexOf('세션') !== -1) {
        localStorage.removeItem('session_token');
        localStorage.removeItem('employee');
        location.reload();
        return data;
      }
      return data;
    } catch (e) {
      console.error('API Error:', e);
      return { success: false, error: '서버 통신 오류가 발생했습니다.' };
    }
  },

  /* 인증 */
  login(id, pw)        { return this.request('login', { employee_id: id, password: pw }); },
  loginToken(token)    { return this.request('login', { unique_token: token }); },
  verifySession()      { return this.request('verify_session'); },

  /* 퇴근 */
  getStatus()          { return this.request('get_current_status'); },
  clockOut(lat, lng)   { return this.request('clock_out', { latitude: lat, longitude: lng }); },

  /* 기록 */
  getRecords(year)     { return this.request('get_records', { year: year }); },
  getMonthlySummary(y) { return this.request('get_monthly_summary', { year: y }); },

  /* 관리자 */
  adminLogin(pw)       { return this.request('admin_login', { password: pw }); },
  getDashboard(ym)     { return this.request('get_dashboard_data', { year_month: ym }); },
  getAllStats(ym)       { return this.request('get_all_stats', { year_month: ym }); },
  genAllQR(base)       { return this.request('generate_all_qr', { base_url: base }); },
  addEmployee(d)       { return this.request('add_employee', d); },
  getEmployees()       { return this.request('get_employees'); },
  updateSettings(s)    { return this.request('update_settings', { settings: s }); }
};
