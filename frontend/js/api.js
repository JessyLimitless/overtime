/**
 * api.js - Apps Script Web App 통신 모듈
 * 모든 API 호출을 POST + JSON body (Content-Type: text/plain) 로 수행
 */
var API_BASE = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

var API = {
  /** 공통 요청 */
  call: function(action, extra) {
    var body = Object.assign(
      { action: action, session_token: localStorage.getItem('st') || '' },
      extra || {}
    );
    return fetch(API_BASE, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (!d.success && d.error && d.error.indexOf('세션') > -1) {
        localStorage.removeItem('st');
        localStorage.removeItem('emp');
        location.reload();
      }
      return d;
    })
    .catch(function(e){
      console.error('API', e);
      return { success:false, error:'서버 통신 오류가 발생했습니다.' };
    });
  },

  /* ── 인증 ── */
  login:       function(id,pw)  { return this.call('login', {employee_id:id, password:pw}); },
  loginToken:  function(t)      { return this.call('login', {unique_token:t}); },
  verify:      function()       { return this.call('verify_session'); },

  /* ── 퇴근 ── */
  status:      function()       { return this.call('get_current_status'); },
  clockOut:    function(lat,lng) { return this.call('clock_out', {latitude:lat, longitude:lng}); },

  /* ── 기록 ── */
  records:     function(y)      { return this.call('get_records',  {year:y}); },
  monthly:     function(y)      { return this.call('get_monthly_summary', {year:y}); },

  /* ── 관리자 ── */
  adminLogin:  function(pw)     { return this.call('admin_login', {password:pw}); },
  dashboard:   function(ym)     { return this.call('get_dashboard_data', {year_month:ym}); },
  allStats:    function(ym)     { return this.call('get_all_stats', {year_month:ym}); },
  genAllQR:    function(base)   { return this.call('generate_all_qr', {base_url:base}); },
  addEmp:      function(d)      { return this.call('add_employee', d); },
  employees:   function()       { return this.call('get_employees'); },
  saveSettings:function(arr)    { return this.call('update_settings', {settings:arr}); },
  getSettings: function()       { return this.call('get_settings'); }
};
