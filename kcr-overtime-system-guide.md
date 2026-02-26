# 한국기업평가 노동조합 시간외근무 기록 시스템 - 구현 가이드

> **프로젝트명**: KCR Overtime Tracker  
> **클라이언트**: 한국기업평가 노동조합  
> **대상 사용자**: 조합원 약 110명 + 관리자  
> **기술 스택**: Google Workspace (Google Sheets + Apps Script) + Mobile Web  
> **이 문서는 Claude Code에서 순차적으로 실행하기 위한 구현 가이드입니다.**

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [Phase 1: Google Sheets DB 설계](#3-phase-1-google-sheets-db-설계)
4. [Phase 2: Google Apps Script 백엔드](#4-phase-2-google-apps-script-백엔드)
5. [Phase 3: 조합원 모바일 웹 프론트엔드](#5-phase-3-조합원-모바일-웹-프론트엔드)
6. [Phase 4: 관리자 페이지](#6-phase-4-관리자-페이지)
7. [배포 및 운영 가이드](#7-배포-및-운영-가이드)
8. [보안 고려사항](#8-보안-고려사항)

---

## 1. 프로젝트 개요

### 1-1. 프로젝트 배경 및 목표

- 직원별 시간외근무 데이터의 객관적 확보 및 권리 보장 근거 자료 마련
- 약 110명의 조합원 대상
- 별도 서버 비용 없이 Google Workspace 기반으로 구축

### 1-2. 핵심 기능 요약

| 번호 | 기능 | 설명 |
|------|------|------|
| 2-1 | 개별 QR 접속 | 직원별 고유 URL(QR코드)로 앱 설치 없이 접속 |
| 2-2 | 본인 인증 | 최초 접속 시 사번/비밀번호 → 이후 브라우저 세션 유지 |
| 2-3 | 퇴근 기록 | 접속 시 현재 시간 자동 표시, [퇴근 확정] 버튼 클릭으로 기록 |
| 2-4 | 기록 조회 | 연도별 1년간 퇴근 시간 및 시간외근무 내역 조회 메뉴 |
| 2-5 | 위치 검증 (선택) | GPS 기반 사무실 반경 내 접속 여부 확인 |
| 2-6 | 시간외근무 자동 환산 | 실제 퇴근 시간 - 기준 퇴근 시간 = 시간외근무(분 단위), 요일별 기준 퇴근시간 설정 가능 |
| 2-7 | 관리자 데이터 관리 | 110명 전체 일자별/월별 누적 통계 자동 생성 |
| 2-8 | 관리자 대시보드 | 주간/월간 시간외근무 과다 부서/개인 시각화(차트) |
| 2-9 | QR 일괄 생성 | 신규 인원 발생 시 클릭 한 번으로 고유 QR URL 생성 |

### 1-3. 지원 디바이스

- **모바일 웹** (모바일 최적화 반응형)
- iOS Safari, Android Chrome 주요 타겟

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    사용자 (조합원)                      │
│              모바일 브라우저 접속 (QR 스캔)              │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────┐
│           Google Apps Script (Web App)               │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐    │
│  │ 인증 API │  │ 기록 API  │  │ 관리자 API      │    │
│  │         │  │          │  │                  │    │
│  │ - 로그인 │  │ - 퇴근기록│  │ - 통계 조회     │    │
│  │ - 세션   │  │ - 조회   │  │ - 대시보드 데이터│    │
│  │ - QR생성 │  │ - GPS검증│  │ - QR 일괄생성   │    │
│  └────┬────┘  └────┬─────┘  └───────┬──────────┘    │
│       │            │                │                │
│       ▼            ▼                ▼                │
│  ┌─────────────────────────────────────────────┐    │
│  │          Google Sheets (Database)            │    │
│  │                                              │    │
│  │  [직원마스터] [퇴근기록] [시간외근무] [설정]   │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              프론트엔드 (정적 호스팅)                  │
│                                                      │
│  Option A: Apps Script HtmlService (단일 배포)        │
│  Option B: GitHub Pages / Netlify (별도 호스팅)       │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 조합원 웹 │  │ 기록 조회 웹  │  │ 관리자 웹    │   │
│  └──────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 2-1. 기술 스택 상세

| 영역 | 기술 | 비고 |
|------|------|------|
| DB | Google Sheets | 110명 규모에 충분, 무료 |
| 백엔드 | Google Apps Script | Web App 배포, REST API |
| 프론트엔드 | HTML + Tailwind CSS + Vanilla JS | 또는 React SPA |
| 호스팅 | Apps Script HtmlService 또는 Netlify | 무료 |
| QR 생성 | qrcode.js (프론트) 또는 Google Charts API | 라이브러리 |
| 차트 | Chart.js | 관리자 대시보드 |
| GPS | Browser Geolocation API | 선택 기능 |

### 2-2. 호스팅 방식 비교 및 추천

| 방식 | 장점 | 단점 | 추천 |
|------|------|------|------|
| **Apps Script HtmlService** | 단일 배포, CORS 없음, 인증 통합 | UI 제약, 속도 느림 | △ |
| **Netlify + Apps Script API** | 빠른 UI, 자유로운 프론트엔드 | CORS 설정 필요, 별도 배포 | ★ 추천 |
| **GitHub Pages + Apps Script API** | 무료, 간단 | CORS 설정, 빌드 필요 | ○ |

**추천**: Netlify (프론트엔드) + Google Apps Script (백엔드 API)

---

## 3. Phase 1: Google Sheets DB 설계

### 3-1. 스프레드시트 구조

하나의 Google Spreadsheet 파일 내에 아래 시트(탭)를 생성합니다.

#### 시트 1: `직원마스터` (employees)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | employee_id | String | 사번 (PK) | "EMP001" |
| B | name | String | 이름 | "김철수" |
| C | department | String | 부서명 | "경영지원팀" |
| D | position | String | 직급 | "대리" |
| E | password_hash | String | 비밀번호 해시 (SHA-256) | "a1b2c3..." |
| F | unique_token | String | 고유 접속 토큰 (QR URL용) | "tk_a1b2c3d4e5" |
| G | qr_url | String | 고유 QR 접속 URL | "https://app.com/?t=tk_a1b2c3d4e5" |
| H | is_active | Boolean | 재직 여부 | TRUE |
| I | created_at | DateTime | 등록일 | "2025-01-15 09:00:00" |
| J | last_login | DateTime | 최근 로그인 | "2025-03-01 18:30:00" |

#### 시트 2: `퇴근기록` (clock_out_records)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | record_id | String | 기록 ID (PK, 자동생성) | "REC_20250301_EMP001" |
| B | employee_id | String | 사번 (FK) | "EMP001" |
| C | record_date | Date | 기록 날짜 | "2025-03-01" |
| D | clock_out_time | DateTime | 실제 퇴근 시간 | "2025-03-01 19:45:00" |
| E | base_clock_out | String | 기준 퇴근 시간 (HH:MM) | "18:00" |
| F | overtime_minutes | Number | 시간외근무 (분) | 105 |
| G | overtime_hours | Number | 시간외근무 (시간, 소수점) | 1.75 |
| H | gps_lat | Number | GPS 위도 (선택) | 37.5665 |
| I | gps_lng | Number | GPS 경도 (선택) | 126.9780 |
| J | gps_verified | Boolean | 위치 검증 통과 여부 | TRUE |
| K | day_of_week | String | 요일 | "토" |
| L | created_at | DateTime | 기록 생성 시각 | "2025-03-01 19:45:00" |
| M | ip_address | String | 접속 IP (참고용) | "210.xxx.xxx.xxx" |

#### 시트 3: `시간외근무_월별통계` (monthly_stats)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | stat_id | String | 통계 ID | "STAT_202503_EMP001" |
| B | employee_id | String | 사번 | "EMP001" |
| C | name | String | 이름 | "김철수" |
| D | department | String | 부서 | "경영지원팀" |
| E | year_month | String | 년월 | "2025-03" |
| F | total_overtime_minutes | Number | 월 총 시간외근무(분) | 2340 |
| G | total_overtime_hours | Number | 월 총 시간외근무(시간) | 39.0 |
| H | work_days_count | Number | 출근일수 | 22 |
| I | overtime_days_count | Number | 시간외근무 발생일수 | 18 |
| J | avg_overtime_minutes | Number | 일평균 시간외근무(분) | 130 |
| K | max_overtime_date | Date | 최대 시간외근무 일자 | "2025-03-15" |
| L | max_overtime_minutes | Number | 최대 시간외근무(분) | 240 |

#### 시트 4: `설정` (settings)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | setting_key | String | 설정 키 | "base_clock_out_mon" |
| B | setting_value | String | 설정 값 | "18:00" |
| C | description | String | 설명 | "월요일 기준 퇴근시간" |
| D | updated_at | DateTime | 수정일 | "2025-01-01" |

**기본 설정 데이터:**

```
base_clock_out_mon, 18:00, 월요일 기준 퇴근시간
base_clock_out_tue, 18:00, 화요일 기준 퇴근시간
base_clock_out_wed, 18:00, 수요일 기준 퇴근시간
base_clock_out_thu, 18:00, 목요일 기준 퇴근시간
base_clock_out_fri, 18:00, 금요일 기준 퇴근시간
base_clock_out_sat, 00:00, 토요일 기준 퇴근시간 (근무 시작부터 전체 산정)
base_clock_out_sun, 00:00, 일요일 기준 퇴근시간 (근무 시작부터 전체 산정)
office_lat, 37.5665, 사무실 위도
office_lng, 126.9780, 사무실 경도
office_radius_m, 500, 사무실 반경 (미터)
gps_enabled, true, GPS 검증 활성화 여부
admin_password_hash, [해시값], 관리자 비밀번호 해시
session_expire_hours, 24, 세션 만료 시간
```

#### 시트 5: `세션` (sessions)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | session_token | String | 세션 토큰 | "ses_abc123def456" |
| B | employee_id | String | 사번 | "EMP001" |
| C | created_at | DateTime | 생성 시각 | "2025-03-01 18:00:00" |
| D | expires_at | DateTime | 만료 시각 | "2025-03-02 18:00:00" |
| E | is_active | Boolean | 활성 여부 | TRUE |

#### 시트 6: `관리자_로그` (admin_logs)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | log_id | String | 로그 ID | "LOG_20250301_001" |
| B | admin_action | String | 수행 작업 | "QR_GENERATE" |
| C | target_employee | String | 대상 직원 | "EMP001" |
| D | details | String | 상세 내용 | "QR 코드 재생성" |
| E | timestamp | DateTime | 시각 | "2025-03-01 10:00:00" |

---

## 4. Phase 2: Google Apps Script 백엔드

### 4-1. 프로젝트 파일 구조

```
/gas-backend/
├── Code.gs              # 메인 엔트리 (doGet, doPost)
├── Auth.gs              # 인증 관련 함수
├── ClockOut.gs          # 퇴근 기록 관련 함수
├── Overtime.gs          # 시간외근무 산출 로직
├── Admin.gs             # 관리자 기능
├── QRGenerator.gs       # QR URL 생성
├── GPS.gs               # 위치 검증 함수
├── Utils.gs             # 유틸리티 함수
├── Config.gs            # 설정 상수
└── appsscript.json      # 프로젝트 설정
```

### 4-2. 메인 엔트리포인트 (Code.gs)

```javascript
/**
 * Code.gs - 메인 엔트리포인트
 * Google Apps Script Web App의 진입점
 */

// 상수 정의
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // 실제 스프레드시트 ID로 교체

// GET 요청 핸들러
function doGet(e) {
  return handleRequest(e, 'GET');
}

// POST 요청 핸들러
function doPost(e) {
  return handleRequest(e, 'POST');
}

// 요청 라우터
function handleRequest(e, method) {
  const params = method === 'GET' ? e.parameter : JSON.parse(e.postData.contents);
  const action = params.action || e.parameter.action;
  
  let result;
  
  try {
    switch (action) {
      // 인증
      case 'login':
        result = handleLogin(params);
        break;
      case 'verify_session':
        result = verifySession(params.session_token);
        break;
      
      // 퇴근 기록
      case 'clock_out':
        result = handleClockOut(params);
        break;
      case 'get_current_status':
        result = getCurrentStatus(params);
        break;
      
      // 기록 조회
      case 'get_records':
        result = getRecords(params);
        break;
      case 'get_monthly_summary':
        result = getMonthlySummary(params);
        break;
      
      // 관리자
      case 'admin_login':
        result = handleAdminLogin(params);
        break;
      case 'get_all_stats':
        result = getAllStats(params);
        break;
      case 'get_dashboard_data':
        result = getDashboardData(params);
        break;
      case 'generate_qr':
        result = generateQR(params);
        break;
      case 'generate_all_qr':
        result = generateAllQR(params);
        break;
      case 'add_employee':
        result = addEmployee(params);
        break;
      case 'update_settings':
        result = updateSettings(params);
        break;
      
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }
  
  // CORS 헤더 포함 JSON 응답
  const output = ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
  
  return output;
}

// 스프레드시트 접근 헬퍼
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(sheetName);
}
```

### 4-3. 인증 모듈 (Auth.gs)

```javascript
/**
 * Auth.gs - 인증 관련 함수
 * 사번/비밀번호 로그인, 세션 관리, 토큰 검증
 */

// SHA-256 해시 생성
function hashPassword(password) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    password, 
    Utilities.Charset.UTF_8
  );
  return rawHash.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// 고유 토큰 생성
function generateToken(prefix) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2, 15);
  const raw = prefix + '_' + timestamp + '_' + random;
  return prefix + '_' + Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, raw
  ).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').substring(0, 16);
}

// 로그인 처리
function handleLogin(params) {
  const { employee_id, password, unique_token } = params;
  const sheet = getSheet('직원마스터');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  let targetRow = null;
  let targetIndex = -1;
  
  // unique_token으로 접속한 경우 (QR 코드 스캔)
  if (unique_token) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][5] === unique_token && data[i][7] === true) { // F열: unique_token, H열: is_active
        targetRow = data[i];
        targetIndex = i;
        break;
      }
    }
    if (!targetRow) {
      return { success: false, error: '유효하지 않은 접속 링크입니다.' };
    }
  }
  
  // 사번 + 비밀번호 인증
  if (employee_id && password) {
    const passwordHash = hashPassword(password);
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === employee_id && data[i][4] === passwordHash && data[i][7] === true) {
        targetRow = data[i];
        targetIndex = i;
        break;
      }
    }
    if (!targetRow) {
      return { success: false, error: '사번 또는 비밀번호가 올바르지 않습니다.' };
    }
  }
  
  if (!targetRow) {
    return { success: false, error: '인증 정보가 필요합니다.' };
  }
  
  // 세션 생성
  const sessionToken = generateToken('ses');
  const now = new Date();
  const settingsSheet = getSheet('설정');
  const expireHours = getSettingValue('session_expire_hours') || 24;
  const expiresAt = new Date(now.getTime() + expireHours * 60 * 60 * 1000);
  
  const sessionSheet = getSheet('세션');
  sessionSheet.appendRow([sessionToken, targetRow[0], now, expiresAt, true]);
  
  // last_login 업데이트
  sheet.getRange(targetIndex + 1, 10).setValue(now); // J열
  
  return {
    success: true,
    session_token: sessionToken,
    employee: {
      employee_id: targetRow[0],
      name: targetRow[1],
      department: targetRow[2],
      position: targetRow[3]
    }
  };
}

// 세션 검증
function verifySession(sessionToken) {
  if (!sessionToken) {
    return { success: false, error: '세션 토큰이 필요합니다.' };
  }
  
  const sheet = getSheet('세션');
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionToken && data[i][4] === true) {
      const expiresAt = new Date(data[i][3]);
      if (now < expiresAt) {
        // 유효한 세션 - 직원 정보 반환
        const empSheet = getSheet('직원마스터');
        const empData = empSheet.getDataRange().getValues();
        for (let j = 1; j < empData.length; j++) {
          if (empData[j][0] === data[i][1]) {
            return {
              success: true,
              employee: {
                employee_id: empData[j][0],
                name: empData[j][1],
                department: empData[j][2],
                position: empData[j][3]
              }
            };
          }
        }
      } else {
        // 만료된 세션 비활성화
        sheet.getRange(i + 1, 5).setValue(false);
      }
    }
  }
  
  return { success: false, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
}

// 설정값 조회 헬퍼
function getSettingValue(key) {
  const sheet = getSheet('설정');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}
```

### 4-4. 퇴근 기록 모듈 (ClockOut.gs)

```javascript
/**
 * ClockOut.gs - 퇴근 기록 처리
 * 퇴근 시간 기록, 시간외근무 자동 산출
 */

// 현재 상태 조회 (퇴근 기록 페이지 진입 시)
function getCurrentStatus(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const employee = session.employee;
  const now = new Date();
  const today = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  const dayOfWeek = getDayOfWeekKR(now);
  
  // 오늘 이미 퇴근 기록이 있는지 확인
  const recordSheet = getSheet('퇴근기록');
  const records = recordSheet.getDataRange().getValues();
  let todayRecord = null;
  
  for (let i = 1; i < records.length; i++) {
    if (records[i][1] === employee.employee_id) {
      const recordDate = Utilities.formatDate(new Date(records[i][2]), 'Asia/Seoul', 'yyyy-MM-dd');
      if (recordDate === today) {
        todayRecord = {
          clock_out_time: records[i][3],
          overtime_minutes: records[i][5],
          overtime_hours: records[i][6]
        };
        break;
      }
    }
  }
  
  // 오늘의 기준 퇴근 시간
  const baseClock = getBaseClockOut(now);
  
  return {
    success: true,
    employee: employee,
    current_time: Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    day_of_week: dayOfWeek,
    base_clock_out: baseClock,
    today_record: todayRecord,
    already_recorded: todayRecord !== null
  };
}

// 퇴근 기록 처리
function handleClockOut(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const employee = session.employee;
  const now = new Date();
  const today = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  
  // 중복 기록 방지
  const recordSheet = getSheet('퇴근기록');
  const records = recordSheet.getDataRange().getValues();
  for (let i = 1; i < records.length; i++) {
    if (records[i][1] === employee.employee_id) {
      const recordDate = Utilities.formatDate(new Date(records[i][2]), 'Asia/Seoul', 'yyyy-MM-dd');
      if (recordDate === today) {
        return { success: false, error: '오늘 이미 퇴근 기록이 있습니다.' };
      }
    }
  }
  
  // GPS 검증 (선택)
  const gpsEnabled = getSettingValue('gps_enabled') === 'true';
  let gpsVerified = true;
  let gpsLat = null;
  let gpsLng = null;
  
  if (gpsEnabled && params.latitude && params.longitude) {
    gpsLat = parseFloat(params.latitude);
    gpsLng = parseFloat(params.longitude);
    gpsVerified = verifyGPS(gpsLat, gpsLng);
  }
  
  // 시간외근무 산출
  const baseClock = getBaseClockOut(now);
  const overtimeMinutes = calculateOvertime(now, baseClock);
  const overtimeHours = Math.round((overtimeMinutes / 60) * 100) / 100;
  
  // 기록 저장
  const recordId = 'REC_' + Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd') + '_' + employee.employee_id;
  const dayOfWeek = getDayOfWeekKR(now);
  
  recordSheet.appendRow([
    recordId,                    // A: record_id
    employee.employee_id,        // B: employee_id
    now,                         // C: record_date
    now,                         // D: clock_out_time
    baseClock,                   // E: base_clock_out
    overtimeMinutes,             // F: overtime_minutes
    overtimeHours,               // G: overtime_hours
    gpsLat,                      // H: gps_lat
    gpsLng,                      // I: gps_lng
    gpsVerified,                 // J: gps_verified
    dayOfWeek,                   // K: day_of_week
    now,                         // L: created_at
    ''                           // M: ip_address (Apps Script에서 직접 획득 불가)
  ]);
  
  // 월별 통계 업데이트 트리거
  updateMonthlyStats(employee.employee_id, now);
  
  return {
    success: true,
    record: {
      record_id: recordId,
      clock_out_time: Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
      base_clock_out: baseClock,
      overtime_minutes: overtimeMinutes,
      overtime_hours: overtimeHours,
      gps_verified: gpsVerified
    }
  };
}

// 기준 퇴근 시간 조회
function getBaseClockOut(date) {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = 'base_clock_out_' + days[date.getDay()];
  return getSettingValue(dayKey) || '18:00';
}

// 시간외근무 산출 (분 단위)
function calculateOvertime(actualTime, baseClockOut) {
  const [baseHour, baseMin] = baseClockOut.split(':').map(Number);
  const actualHour = actualTime.getHours();
  const actualMin = actualTime.getMinutes();
  
  const baseMinutes = baseHour * 60 + baseMin;
  const actualMinutes = actualHour * 60 + actualMin;
  
  const overtime = actualMinutes - baseMinutes;
  return overtime > 0 ? overtime : 0;
}

// 요일 한글 변환
function getDayOfWeekKR(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
}
```

### 4-5. 기록 조회 모듈 (Records.gs)

```javascript
/**
 * Records.gs - 기록 조회 기능
 * 연도별 퇴근 기록 및 시간외근무 조회
 */

// 개인 기록 조회
function getRecords(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const employee = session.employee;
  const year = params.year || new Date().getFullYear();
  
  const sheet = getSheet('퇴근기록');
  const data = sheet.getDataRange().getValues();
  const records = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === employee.employee_id) {
      const recordDate = new Date(data[i][2]);
      if (recordDate.getFullYear() === parseInt(year)) {
        records.push({
          record_id: data[i][0],
          record_date: Utilities.formatDate(recordDate, 'Asia/Seoul', 'yyyy-MM-dd'),
          clock_out_time: Utilities.formatDate(new Date(data[i][3]), 'Asia/Seoul', 'HH:mm'),
          base_clock_out: data[i][4],
          overtime_minutes: data[i][5],
          overtime_hours: data[i][6],
          day_of_week: data[i][10],
          gps_verified: data[i][9]
        });
      }
    }
  }
  
  // 날짜 역순 정렬
  records.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
  
  // 월별 소계 계산
  const monthlySummary = {};
  records.forEach(r => {
    const month = r.record_date.substring(0, 7); // "2025-03"
    if (!monthlySummary[month]) {
      monthlySummary[month] = { total_minutes: 0, count: 0 };
    }
    monthlySummary[month].total_minutes += r.overtime_minutes;
    monthlySummary[month].count += 1;
  });
  
  return {
    success: true,
    year: year,
    records: records,
    monthly_summary: monthlySummary,
    total_records: records.length
  };
}

// 월별 요약 조회
function getMonthlySummary(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const employee = session.employee;
  const year = params.year || new Date().getFullYear();
  
  const sheet = getSheet('시간외근무_월별통계');
  const data = sheet.getDataRange().getValues();
  const summaries = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === employee.employee_id && data[i][4].startsWith(String(year))) {
      summaries.push({
        year_month: data[i][4],
        total_overtime_minutes: data[i][5],
        total_overtime_hours: data[i][6],
        work_days_count: data[i][7],
        overtime_days_count: data[i][8],
        avg_overtime_minutes: data[i][9]
      });
    }
  }
  
  summaries.sort((a, b) => b.year_month.localeCompare(a.year_month));
  
  return {
    success: true,
    year: year,
    summaries: summaries
  };
}

// 월별 통계 업데이트 (퇴근 기록 시 자동 호출)
function updateMonthlyStats(employeeId, date) {
  const yearMonth = Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM');
  const statId = 'STAT_' + yearMonth.replace('-', '') + '_' + employeeId;
  
  // 해당 월의 모든 기록 조회
  const recordSheet = getSheet('퇴근기록');
  const records = recordSheet.getDataRange().getValues();
  
  let totalMinutes = 0;
  let workDays = 0;
  let overtimeDays = 0;
  let maxMinutes = 0;
  let maxDate = '';
  
  for (let i = 1; i < records.length; i++) {
    if (records[i][1] === employeeId) {
      const recordYM = Utilities.formatDate(new Date(records[i][2]), 'Asia/Seoul', 'yyyy-MM');
      if (recordYM === yearMonth) {
        workDays++;
        const minutes = records[i][5] || 0;
        totalMinutes += minutes;
        if (minutes > 0) overtimeDays++;
        if (minutes > maxMinutes) {
          maxMinutes = minutes;
          maxDate = Utilities.formatDate(new Date(records[i][2]), 'Asia/Seoul', 'yyyy-MM-dd');
        }
      }
    }
  }
  
  // 직원 정보
  const empSheet = getSheet('직원마스터');
  const empData = empSheet.getDataRange().getValues();
  let empName = '';
  let empDept = '';
  for (let i = 1; i < empData.length; i++) {
    if (empData[i][0] === employeeId) {
      empName = empData[i][1];
      empDept = empData[i][2];
      break;
    }
  }
  
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const avgMinutes = workDays > 0 ? Math.round(totalMinutes / workDays) : 0;
  
  // 기존 통계 업데이트 또는 신규 생성
  const statsSheet = getSheet('시간외근무_월별통계');
  const statsData = statsSheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < statsData.length; i++) {
    if (statsData[i][0] === statId) {
      const row = i + 1;
      statsSheet.getRange(row, 6).setValue(totalMinutes);
      statsSheet.getRange(row, 7).setValue(totalHours);
      statsSheet.getRange(row, 8).setValue(workDays);
      statsSheet.getRange(row, 9).setValue(overtimeDays);
      statsSheet.getRange(row, 10).setValue(avgMinutes);
      statsSheet.getRange(row, 11).setValue(maxDate);
      statsSheet.getRange(row, 12).setValue(maxMinutes);
      found = true;
      break;
    }
  }
  
  if (!found) {
    statsSheet.appendRow([
      statId, employeeId, empName, empDept, yearMonth,
      totalMinutes, totalHours, workDays, overtimeDays,
      avgMinutes, maxDate, maxMinutes
    ]);
  }
}
```

### 4-6. GPS 검증 모듈 (GPS.gs)

```javascript
/**
 * GPS.gs - GPS 위치 검증
 * Haversine 공식으로 사무실 반경 내 접속 여부 확인
 */

function verifyGPS(lat, lng) {
  const officeLat = parseFloat(getSettingValue('office_lat'));
  const officeLng = parseFloat(getSettingValue('office_lng'));
  const radiusM = parseFloat(getSettingValue('office_radius_m')) || 500;
  
  const distance = haversineDistance(lat, lng, officeLat, officeLng);
  return distance <= radiusM;
}

// Haversine 공식 (미터 단위 거리 계산)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 지구 반경 (미터)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}
```

### 4-7. 관리자 기능 모듈 (Admin.gs)

```javascript
/**
 * Admin.gs - 관리자 전용 기능
 * 전체 통계 조회, 대시보드 데이터, QR 일괄 생성
 */

// 관리자 로그인
function handleAdminLogin(params) {
  const adminHash = getSettingValue('admin_password_hash');
  const inputHash = hashPassword(params.password);
  
  if (inputHash !== adminHash) {
    return { success: false, error: '관리자 비밀번호가 올바르지 않습니다.' };
  }
  
  const sessionToken = generateToken('adm');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8시간
  
  const sessionSheet = getSheet('세션');
  sessionSheet.appendRow([sessionToken, 'ADMIN', now, expiresAt, true]);
  
  return { success: true, session_token: sessionToken, role: 'admin' };
}

// 전체 직원 통계 조회
function getAllStats(params) {
  // 관리자 세션 검증
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const yearMonth = params.year_month; // "2025-03"
  const sheet = getSheet('시간외근무_월별통계');
  const data = sheet.getDataRange().getValues();
  const stats = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!yearMonth || data[i][4] === yearMonth) {
      stats.push({
        employee_id: data[i][1],
        name: data[i][2],
        department: data[i][3],
        year_month: data[i][4],
        total_overtime_hours: data[i][6],
        work_days: data[i][7],
        overtime_days: data[i][8],
        avg_overtime_minutes: data[i][9]
      });
    }
  }
  
  return { success: true, stats: stats };
}

// 대시보드 데이터 (차트용)
function getDashboardData(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const yearMonth = params.year_month || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  
  const sheet = getSheet('시간외근무_월별통계');
  const data = sheet.getDataRange().getValues();
  
  // 부서별 집계
  const deptStats = {};
  // 개인별 랭킹
  const personalStats = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][4] === yearMonth) {
      const dept = data[i][3];
      if (!deptStats[dept]) {
        deptStats[dept] = { total_hours: 0, employee_count: 0 };
      }
      deptStats[dept].total_hours += data[i][6];
      deptStats[dept].employee_count += 1;
      
      personalStats.push({
        name: data[i][2],
        department: dept,
        total_hours: data[i][6],
        overtime_days: data[i][8]
      });
    }
  }
  
  // 부서별 평균 산출
  const deptSummary = Object.entries(deptStats).map(([dept, stat]) => ({
    department: dept,
    total_hours: Math.round(stat.total_hours * 100) / 100,
    avg_hours: Math.round((stat.total_hours / stat.employee_count) * 100) / 100,
    employee_count: stat.employee_count
  }));
  
  // 시간외근무 상위 10명
  personalStats.sort((a, b) => b.total_hours - a.total_hours);
  const top10 = personalStats.slice(0, 10);
  
  // 주간 트렌드 (최근 4주)
  const weeklyTrend = getWeeklyTrend(yearMonth);
  
  return {
    success: true,
    year_month: yearMonth,
    department_summary: deptSummary,
    top_overtime_employees: top10,
    weekly_trend: weeklyTrend,
    total_employees: personalStats.length
  };
}

// 주간 트렌드 데이터
function getWeeklyTrend(yearMonth) {
  const sheet = getSheet('퇴근기록');
  const data = sheet.getDataRange().getValues();
  const weekData = {};
  
  for (let i = 1; i < data.length; i++) {
    const recordDate = new Date(data[i][2]);
    const recordYM = Utilities.formatDate(recordDate, 'Asia/Seoul', 'yyyy-MM');
    if (recordYM === yearMonth) {
      const weekNum = getWeekNumber(recordDate);
      const key = yearMonth + '-W' + weekNum;
      if (!weekData[key]) {
        weekData[key] = { total_minutes: 0, count: 0 };
      }
      weekData[key].total_minutes += (data[i][5] || 0);
      weekData[key].count += 1;
    }
  }
  
  return Object.entries(weekData).map(([week, stat]) => ({
    week: week,
    total_hours: Math.round((stat.total_minutes / 60) * 100) / 100,
    record_count: stat.count
  }));
}

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
}

// QR URL 일괄 생성
function generateAllQR(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const baseUrl = params.base_url || 'https://your-app.netlify.app';
  const sheet = getSheet('직원마스터');
  const data = sheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][7] === true) { // is_active
      let token = data[i][5]; // unique_token
      
      // 토큰이 없으면 생성
      if (!token) {
        token = generateToken('tk');
        sheet.getRange(i + 1, 6).setValue(token); // F열
      }
      
      const qrUrl = baseUrl + '/?t=' + token;
      sheet.getRange(i + 1, 7).setValue(qrUrl); // G열
      
      results.push({
        employee_id: data[i][0],
        name: data[i][1],
        department: data[i][2],
        qr_url: qrUrl,
        token: token
      });
    }
  }
  
  return { success: true, results: results, count: results.length };
}

// 단일 QR 생성 (신규 직원)
function generateQR(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const baseUrl = params.base_url || 'https://your-app.netlify.app';
  const employeeId = params.employee_id;
  
  const sheet = getSheet('직원마스터');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === employeeId) {
      const token = generateToken('tk');
      const qrUrl = baseUrl + '/?t=' + token;
      
      sheet.getRange(i + 1, 6).setValue(token);
      sheet.getRange(i + 1, 7).setValue(qrUrl);
      
      return {
        success: true,
        employee_id: employeeId,
        qr_url: qrUrl,
        token: token
      };
    }
  }
  
  return { success: false, error: '직원을 찾을 수 없습니다.' };
}

// 직원 추가
function addEmployee(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const sheet = getSheet('직원마스터');
  const baseUrl = params.base_url || 'https://your-app.netlify.app';
  const token = generateToken('tk');
  const qrUrl = baseUrl + '/?t=' + token;
  const now = new Date();
  
  sheet.appendRow([
    params.employee_id,
    params.name,
    params.department,
    params.position || '',
    hashPassword(params.initial_password || '0000'),
    token,
    qrUrl,
    true,
    now,
    ''
  ]);
  
  return {
    success: true,
    employee_id: params.employee_id,
    qr_url: qrUrl
  };
}

// 설정 업데이트
function updateSettings(params) {
  const session = verifySession(params.session_token);
  if (!session.success) return session;
  
  const sheet = getSheet('설정');
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  
  const updates = params.settings; // [{key, value}]
  
  updates.forEach(update => {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === update.key) {
        sheet.getRange(i + 1, 2).setValue(update.value);
        sheet.getRange(i + 1, 4).setValue(now);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([update.key, update.value, update.description || '', now]);
    }
  });
  
  return { success: true, message: '설정이 업데이트되었습니다.' };
}
```

### 4-8. Apps Script 배포 설정 (appsscript.json)

```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {},
  "webapp": {
    "access": "ANYONE_ANONYMOUS",
    "executeAs": "ME"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

### 4-9. 초기 데이터 셋업 스크립트 (Setup.gs)

```javascript
/**
 * Setup.gs - 초기 설정 스크립트
 * 최초 1회 실행하여 시트 구조 및 기본 데이터를 생성합니다.
 */

function initialSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. 시트 생성
  const sheets = {
    '직원마스터': ['employee_id','name','department','position','password_hash','unique_token','qr_url','is_active','created_at','last_login'],
    '퇴근기록': ['record_id','employee_id','record_date','clock_out_time','base_clock_out','overtime_minutes','overtime_hours','gps_lat','gps_lng','gps_verified','day_of_week','created_at','ip_address'],
    '시간외근무_월별통계': ['stat_id','employee_id','name','department','year_month','total_overtime_minutes','total_overtime_hours','work_days_count','overtime_days_count','avg_overtime_minutes','max_overtime_date','max_overtime_minutes'],
    '설정': ['setting_key','setting_value','description','updated_at'],
    '세션': ['session_token','employee_id','created_at','expires_at','is_active'],
    '관리자_로그': ['log_id','admin_action','target_employee','details','timestamp']
  };
  
  Object.entries(sheets).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
  
  // 2. 기본 설정 데이터 삽입
  const settingsSheet = ss.getSheetByName('설정');
  const defaultSettings = [
    ['base_clock_out_mon', '18:00', '월요일 기준 퇴근시간', new Date()],
    ['base_clock_out_tue', '18:00', '화요일 기준 퇴근시간', new Date()],
    ['base_clock_out_wed', '18:00', '수요일 기준 퇴근시간', new Date()],
    ['base_clock_out_thu', '18:00', '목요일 기준 퇴근시간', new Date()],
    ['base_clock_out_fri', '18:00', '금요일 기준 퇴근시간', new Date()],
    ['base_clock_out_sat', '00:00', '토요일 기준 퇴근시간 (전체 산정)', new Date()],
    ['base_clock_out_sun', '00:00', '일요일 기준 퇴근시간 (전체 산정)', new Date()],
    ['office_lat', '37.5665', '사무실 위도 (실제 좌표로 변경 필요)', new Date()],
    ['office_lng', '126.9780', '사무실 경도 (실제 좌표로 변경 필요)', new Date()],
    ['office_radius_m', '500', '사무실 반경 (미터)', new Date()],
    ['gps_enabled', 'true', 'GPS 검증 활성화 여부', new Date()],
    ['admin_password_hash', hashPassword('admin1234'), '관리자 비밀번호 (변경 필요)', new Date()],
    ['session_expire_hours', '24', '세션 만료 시간 (시간)', new Date()]
  ];
  
  // 기존 설정이 없을 경우에만 삽입
  const existingData = settingsSheet.getDataRange().getValues();
  if (existingData.length <= 1) {
    settingsSheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);
  }
  
  // 3. 테스트 직원 데이터 (선택)
  const empSheet = ss.getSheetByName('직원마스터');
  const existingEmp = empSheet.getDataRange().getValues();
  if (existingEmp.length <= 1) {
    const testEmployees = [
      ['EMP001', '홍길동', '경영지원팀', '대리', hashPassword('1234'), generateToken('tk'), '', true, new Date(), ''],
      ['EMP002', '김영희', '기업평가1팀', '과장', hashPassword('1234'), generateToken('tk'), '', true, new Date(), ''],
      ['EMP003', '이철수', '기업평가2팀', '사원', hashPassword('1234'), generateToken('tk'), '', true, new Date(), '']
    ];
    empSheet.getRange(2, 1, testEmployees.length, 10).setValues(testEmployees);
  }
  
  Logger.log('초기 설정 완료!');
}

// 만료된 세션 정리 (매일 실행하도록 트리거 설정)
function cleanupExpiredSessions() {
  const sheet = getSheet('세션');
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  
  for (let i = data.length - 1; i >= 1; i--) {
    const expiresAt = new Date(data[i][3]);
    if (now > expiresAt) {
      sheet.deleteRow(i + 1);
    }
  }
}

// 트리거 설정
function createTriggers() {
  // 매일 새벽 3시에 만료 세션 정리
  ScriptApp.newTrigger('cleanupExpiredSessions')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
}
```

---

## 5. Phase 3: 조합원 모바일 웹 프론트엔드

### 5-1. 프로젝트 구조

```
/frontend/
├── index.html              # 메인 SPA
├── css/
│   └── style.css           # 커스텀 스타일
├── js/
│   ├── app.js              # 메인 앱 로직
│   ├── api.js              # API 통신 모듈
│   ├── auth.js             # 인증 모듈
│   ├── clockout.js         # 퇴근 기록 모듈
│   ├── records.js          # 기록 조회 모듈
│   └── utils.js            # 유틸리티
├── admin/
│   ├── index.html          # 관리자 페이지
│   ├── dashboard.js        # 대시보드
│   └── management.js       # 직원/QR 관리
└── assets/
    └── logo.png            # 로고
```

### 5-2. 핵심 화면 구성

```
[QR 스캔 접속] → [로그인 화면] → [메인 화면]
                                       │
                      ┌────────────────┼────────────────┐
                      ▼                ▼                ▼
              [퇴근 기록 화면]   [기록 조회 화면]   [내 정보]
                      │                │
                      ▼                ▼
              [기록 완료 확인]   [월별 상세 조회]
```

### 5-3. 화면별 상세 명세

#### 화면 1: 로그인

```
┌─────────────────────────────┐
│                             │
│     🏢 한국기업평가 노조     │
│     시간외근무 기록 시스템     │
│                             │
│  ┌───────────────────────┐  │
│  │ 사번                   │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 비밀번호               │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │      로 그 인          │  │
│  └───────────────────────┘  │
│                             │
│  * QR코드로 접속 시 자동 인식 │
│                             │
└─────────────────────────────┘
```

**구현 로직:**
- URL에 `?t=토큰` 파라미터가 있으면 토큰으로 자동 인증 시도
- 토큰 인증 실패 시 사번/비밀번호 로그인 폼 표시
- 로그인 성공 시 `session_token`을 `localStorage`에 저장
- 이후 접속 시 세션 토큰 자동 검증 → 유효하면 메인 화면 직행

#### 화면 2: 메인 (퇴근 기록)

```
┌─────────────────────────────┐
│ 👤 김철수 (경영지원팀)   ⚙️  │
│─────────────────────────────│
│                             │
│        2025.03.01 (토)      │
│                             │
│     현재 시간               │
│     ┌─────────────────┐    │
│     │   19 : 45 : 30  │    │
│     └─────────────────┘    │
│                             │
│     기준 퇴근: 18:00        │
│     시간외근무: 1시간 45분   │
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │    ⏰ 퇴근 확정        │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  📍 위치 확인됨 (사무실 내)  │
│                             │
│─────────────────────────────│
│  🏠 홈  │  📋 기록  │  👤 정보 │
└─────────────────────────────┘
```

**구현 로직:**
- 접속 시 현재 시간 실시간 표시 (`setInterval` 1초)
- 기준 퇴근 시간은 서버에서 요일별로 조회
- 시간외근무 = 현재시간 - 기준 퇴근시간 (실시간 갱신)
- GPS 활성화 시 `navigator.geolocation.getCurrentPosition()` 호출
- [퇴근 확정] 버튼 → 확인 모달 → API 호출 → 성공 시 결과 표시
- 이미 오늘 기록이 있으면 기록 완료 상태 표시 (버튼 비활성화)

#### 화면 3: 기록 조회

```
┌─────────────────────────────┐
│ ◀ 기록 조회                  │
│─────────────────────────────│
│                             │
│  연도 선택: [2025 ▼]        │
│                             │
│  ── 3월 (합계: 39.0시간) ── │
│                             │
│  03.01 (토) 19:45  1h 45m  │
│  02.28 (금) 20:30  2h 30m  │
│  02.27 (목) 19:00  1h 00m  │
│  02.26 (수) 21:15  3h 15m  │
│  ...                        │
│                             │
│  ── 2월 (합계: 42.5시간) ── │
│  ...                        │
│                             │
│─────────────────────────────│
│  🏠 홈  │  📋 기록  │  👤 정보 │
└─────────────────────────────┘
```

**구현 로직:**
- 연도 선택 드롭다운 (올해 기본, 최근 2년)
- 월별 그룹핑, 각 월 소계 표시
- 날짜 역순 정렬
- 각 기록 터치 시 상세 보기 (GPS 정보 등)

### 5-4. API 통신 모듈 (api.js)

```javascript
/**
 * api.js - Google Apps Script Web App과 통신
 */

const API_BASE = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

class API {
  static async request(action, params = {}) {
    const sessionToken = localStorage.getItem('session_token');
    
    const body = {
      action: action,
      session_token: sessionToken,
      ...params
    };
    
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Apps Script CORS 우회
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      // 세션 만료 처리
      if (!data.success && data.error && data.error.includes('세션')) {
        localStorage.removeItem('session_token');
        window.location.href = '/';
        return;
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, error: '서버 통신 오류가 발생했습니다.' };
    }
  }
  
  // 인증
  static login(employeeId, password) {
    return this.request('login', { employee_id: employeeId, password: password });
  }
  
  static loginWithToken(token) {
    return this.request('login', { unique_token: token });
  }
  
  static verifySession() {
    return this.request('verify_session');
  }
  
  // 퇴근 기록
  static getCurrentStatus() {
    return this.request('get_current_status');
  }
  
  static clockOut(latitude, longitude) {
    return this.request('clock_out', { latitude, longitude });
  }
  
  // 기록 조회
  static getRecords(year) {
    return this.request('get_records', { year: year });
  }
  
  static getMonthlySummary(year) {
    return this.request('get_monthly_summary', { year: year });
  }
  
  // 관리자
  static adminLogin(password) {
    return this.request('admin_login', { password: password });
  }
  
  static getDashboardData(yearMonth) {
    return this.request('get_dashboard_data', { year_month: yearMonth });
  }
  
  static getAllStats(yearMonth) {
    return this.request('get_all_stats', { year_month: yearMonth });
  }
  
  static generateAllQR(baseUrl) {
    return this.request('generate_all_qr', { base_url: baseUrl });
  }
  
  static addEmployee(data) {
    return this.request('add_employee', data);
  }
}
```

### 5-5. 프론트엔드 핵심 기능 (app.js)

```javascript
/**
 * app.js - 메인 앱 로직
 * SPA 라우팅 및 화면 전환
 */

class App {
  constructor() {
    this.currentPage = 'login';
    this.employee = null;
    this.clockInterval = null;
  }
  
  async init() {
    // URL 파라미터에서 토큰 확인 (QR 스캔 접속)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    
    if (token) {
      await this.loginWithToken(token);
      return;
    }
    
    // 기존 세션 확인
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      const result = await API.verifySession();
      if (result.success) {
        this.employee = result.employee;
        this.showMainPage();
        return;
      }
    }
    
    this.showLoginPage();
  }
  
  async loginWithToken(token) {
    this.showLoading('인증 중...');
    const result = await API.loginWithToken(token);
    
    if (result.success) {
      localStorage.setItem('session_token', result.session_token);
      this.employee = result.employee;
      // URL에서 토큰 파라미터 제거
      window.history.replaceState({}, '', '/');
      this.showMainPage();
    } else {
      this.showLoginPage(result.error);
    }
  }
  
  async handleLogin(employeeId, password) {
    this.showLoading('로그인 중...');
    const result = await API.login(employeeId, password);
    
    if (result.success) {
      localStorage.setItem('session_token', result.session_token);
      this.employee = result.employee;
      this.showMainPage();
    } else {
      this.showError(result.error);
    }
  }
  
  showMainPage() {
    // 현재 시간 실시간 표시
    this.startClock();
    // 오늘 기록 상태 확인
    this.loadCurrentStatus();
    // 페이지 렌더링
    this.renderMainPage();
  }
  
  startClock() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(() => {
      this.updateClockDisplay();
    }, 1000);
  }
  
  updateClockDisplay() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour12: false });
    document.getElementById('current-time').textContent = timeStr;
    
    // 시간외근무 실시간 계산
    if (this.baseClockOut) {
      const [bh, bm] = this.baseClockOut.split(':').map(Number);
      const baseMinutes = bh * 60 + bm;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const overtime = nowMinutes - baseMinutes;
      
      if (overtime > 0) {
        const hours = Math.floor(overtime / 60);
        const mins = overtime % 60;
        document.getElementById('overtime-display').textContent = 
          `${hours}시간 ${mins}분`;
      } else {
        document.getElementById('overtime-display').textContent = '-';
      }
    }
  }
  
  async handleClockOut() {
    // 확인 모달
    if (!confirm('퇴근을 확정하시겠습니까?\n확정 후 수정이 불가합니다.')) return;
    
    this.showLoading('기록 중...');
    
    // GPS 위치 획득 시도
    let lat = null, lng = null;
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      console.log('GPS 획득 실패:', e.message);
    }
    
    const result = await API.clockOut(lat, lng);
    
    if (result.success) {
      this.showClockOutSuccess(result.record);
    } else {
      this.showError(result.error);
    }
  }
  
  // ... 렌더링 메서드들 (HTML 템플릿)
}

// 앱 초기화
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
```

### 5-6. 모바일 최적화 CSS 핵심

```css
/* 모바일 최적화 핵심 스타일 */
:root {
  --primary: #2563EB;
  --primary-dark: #1D4ED8;
  --success: #10B981;
  --danger: #EF4444;
  --gray-50: #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-600: #4B5563;
  --gray-900: #111827;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--gray-50);
  color: var(--gray-900);
  -webkit-text-size-adjust: 100%;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100dvh; /* 모바일 주소창 대응 */
}

/* 퇴근 확정 버튼 - 크고 명확하게 */
.btn-clock-out {
  width: 100%;
  padding: 20px;
  font-size: 20px;
  font-weight: 700;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.btn-clock-out:active {
  transform: scale(0.98);
  background: var(--primary-dark);
}

.btn-clock-out:disabled {
  background: var(--gray-100);
  color: var(--gray-600);
}

/* 현재 시간 대형 표시 */
.time-display {
  font-size: 48px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  letter-spacing: 2px;
}

/* 하단 네비게이션 */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  background: white;
  border-top: 1px solid var(--gray-100);
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-nav a {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 12px;
  color: var(--gray-600);
  text-decoration: none;
}

.bottom-nav a.active {
  color: var(--primary);
  font-weight: 600;
}

/* PWA 안전 영역 */
@supports (padding: env(safe-area-inset-bottom)) {
  .page-content {
    padding-bottom: calc(70px + env(safe-area-inset-bottom));
  }
}
```

---

## 6. Phase 4: 관리자 페이지

### 6-1. 관리자 화면 구성

```
[관리자 로그인] → [관리자 대시보드]
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
  [통계 대시보드]  [직원 관리]    [설정 관리]
         │             │             │
         ▼             ▼             ▼
  - 부서별 차트    - 직원 목록    - 기준 퇴근시간
  - 개인별 랭킹    - QR 일괄생성  - GPS 설정
  - 주간 트렌드    - 직원 추가    - 세션 설정
  - 데이터 엑스포트 - 직원 비활성화
```

### 6-2. 대시보드 차트 구현 (Chart.js)

```javascript
/**
 * dashboard.js - 관리자 대시보드
 * Chart.js를 활용한 시각화
 */

class Dashboard {
  constructor() {
    this.charts = {};
  }
  
  async load(yearMonth) {
    const data = await API.getDashboardData(yearMonth);
    if (!data.success) return;
    
    this.renderDeptChart(data.department_summary);
    this.renderTop10Chart(data.top_overtime_employees);
    this.renderWeeklyTrend(data.weekly_trend);
    this.renderSummaryCards(data);
  }
  
  // 부서별 시간외근무 차트
  renderDeptChart(deptData) {
    const ctx = document.getElementById('dept-chart').getContext('2d');
    
    if (this.charts.dept) this.charts.dept.destroy();
    
    this.charts.dept = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: deptData.map(d => d.department),
        datasets: [
          {
            label: '총 시간외근무 (시간)',
            data: deptData.map(d => d.total_hours),
            backgroundColor: 'rgba(37, 99, 235, 0.7)'
          },
          {
            label: '인당 평균 (시간)',
            data: deptData.map(d => d.avg_hours),
            backgroundColor: 'rgba(16, 185, 129, 0.7)'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: '부서별 시간외근무 현황' }
        }
      }
    });
  }
  
  // 시간외근무 상위 10명
  renderTop10Chart(topData) {
    const ctx = document.getElementById('top10-chart').getContext('2d');
    
    if (this.charts.top10) this.charts.top10.destroy();
    
    this.charts.top10 = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: topData.map(d => `${d.name} (${d.department})`),
        datasets: [{
          label: '시간외근무 (시간)',
          data: topData.map(d => d.total_hours),
          backgroundColor: topData.map((_, i) => 
            i < 3 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(37, 99, 235, 0.5)')
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          title: { display: true, text: '시간외근무 상위 10명 (과다 근무 모니터링)' }
        }
      }
    });
  }
  
  // 주간 트렌드
  renderWeeklyTrend(weekData) {
    const ctx = document.getElementById('trend-chart').getContext('2d');
    
    if (this.charts.trend) this.charts.trend.destroy();
    
    this.charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weekData.map(w => w.week),
        datasets: [{
          label: '주간 총 시간외근무 (시간)',
          data: weekData.map(w => w.total_hours),
          borderColor: 'rgb(37, 99, 235)',
          fill: true,
          backgroundColor: 'rgba(37, 99, 235, 0.1)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: '주간 시간외근무 추이' }
        }
      }
    });
  }
}
```

### 6-3. QR 코드 일괄 생성 및 출력

```javascript
/**
 * qr-management.js - QR 코드 관리
 * qrcode.js 라이브러리 활용
 */

class QRManager {
  // QR 일괄 생성 및 출력용 페이지 렌더링
  async generateAndPrint() {
    const result = await API.generateAllQR(window.location.origin);
    if (!result.success) {
      alert('QR 생성 실패: ' + result.error);
      return;
    }
    
    // 인쇄용 HTML 생성
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>QR 코드 목록 - 한국기업평가 노조</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        <style>
          body { font-family: sans-serif; }
          .qr-card {
            display: inline-block;
            width: 200px;
            padding: 16px;
            margin: 8px;
            border: 1px solid #ddd;
            text-align: center;
            page-break-inside: avoid;
          }
          .qr-card .name { font-weight: bold; font-size: 16px; margin-top: 8px; }
          .qr-card .dept { color: #666; font-size: 12px; }
          .qr-card .id { color: #999; font-size: 11px; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h2>한국기업평가 노동조합 - 시간외근무 기록 QR 코드</h2>
        <p>생성일: ${new Date().toLocaleDateString('ko-KR')}</p>
        <button class="no-print" onclick="window.print()">🖨️ 인쇄</button>
        <hr>
        <div id="qr-container"></div>
        <script>
          const employees = ${JSON.stringify(result.results)};
          const container = document.getElementById('qr-container');
          
          employees.forEach(emp => {
            const card = document.createElement('div');
            card.className = 'qr-card';
            card.innerHTML = '<div id="qr-' + emp.employee_id + '"></div>' +
              '<div class="name">' + emp.name + '</div>' +
              '<div class="dept">' + emp.department + '</div>' +
              '<div class="id">' + emp.employee_id + '</div>';
            container.appendChild(card);
            
            new QRCode(document.getElementById('qr-' + emp.employee_id), {
              text: emp.qr_url,
              width: 150,
              height: 150,
              correctLevel: QRCode.CorrectLevel.M
            });
          });
        </script>
      </body>
      </html>
    `);
  }
}
```

---

## 7. 배포 및 운영 가이드

### 7-1. Google Apps Script 배포 절차

```
1. Google Drive에서 새 Google Sheets 생성
2. 도구 > 스크립트 편집기 열기
3. 위의 .gs 파일들을 모두 추가
4. SPREADSHEET_ID를 실제 시트 ID로 변경
5. initialSetup() 함수 최초 1회 실행
6. createTriggers() 함수 최초 1회 실행
7. 배포 > 새 배포 > 웹 앱
   - 실행 주체: 나
   - 액세스: 모든 사용자 (익명 포함)
8. 배포 URL 복사 → 프론트엔드 API_BASE에 설정
```

### 7-2. 프론트엔드 배포 (Netlify)

```
1. GitHub 리포지토리 생성
2. /frontend/ 디렉토리의 파일들 push
3. Netlify에서 리포지토리 연결
4. 빌드 설정:
   - Build command: (없음 - 정적 파일)
   - Publish directory: /frontend
5. 환경변수 설정 (선택):
   - API_URL: Apps Script 배포 URL
6. 배포 완료 후 도메인 확인
```

### 7-3. 초기 데이터 마이그레이션

```
1. 조합원 110명의 사번, 이름, 부서, 직급 정보를 CSV로 준비
2. Google Sheets '직원마스터' 시트에 일괄 입력
3. 비밀번호는 초기값 '0000'으로 일괄 설정 (hashPassword 적용)
4. 관리자 페이지에서 QR 일괄 생성 실행
5. 생성된 QR 코드를 인쇄하여 각 직원에게 배부
```

### 7-4. 운영 체크리스트

| 항목 | 주기 | 내용 |
|------|------|------|
| 세션 정리 | 자동 (일 1회) | cleanupExpiredSessions 트리거 |
| 월별 통계 | 자동 | 퇴근 기록 시 자동 업데이트 |
| 데이터 백업 | 주 1회 권장 | Google Sheets 사본 만들기 |
| 비밀번호 변경 | 분기 1회 | 관리자 비밀번호 갱신 |
| QR 재발급 | 필요 시 | 신규 직원 또는 분실 시 |

---

## 8. 보안 고려사항

### 8-1. 인증 보안

| 항목 | 구현 방식 |
|------|-----------|
| 비밀번호 저장 | SHA-256 해시 (평문 저장 금지) |
| 세션 관리 | 랜덤 토큰 + 만료시간 설정 |
| QR 토큰 | 추측 불가능한 랜덤 문자열 |
| HTTPS | Google Apps Script 기본 HTTPS |
| 세션 만료 | 24시간 (설정 가능) |

### 8-2. 데이터 보안

- Google Sheets 파일 공유 설정: **소유자만 접근** (편집자 제한)
- Apps Script 실행 권한: **배포자 계정으로 실행**
- 프론트엔드에서 민감 정보 노출 금지 (비밀번호 해시 등)

### 8-3. GPS 보안

- 위치 정보는 퇴근 기록 시에만 1회 수집
- 사용자 동의 후 수집 (브라우저 권한 요청)
- 위도/경도만 저장, 상세 주소 저장하지 않음

### 8-4. 추가 보안 권장사항

- 비밀번호 최소 4자리 이상 강제
- 로그인 5회 실패 시 계정 잠금 (선택)
- 관리자 접속 IP 제한 (선택)
- Google Workspace 2단계 인증 활성화

---

## 부록: Claude Code 실행 순서 요약

```
Step 1: Google Sheets 생성 및 스프레드시트 ID 확보
Step 2: Apps Script 편집기에서 백엔드 코드 작성 (Phase 2)
Step 3: initialSetup() 실행하여 시트 구조 생성
Step 4: Web App으로 배포, URL 확보
Step 5: 프론트엔드 프로젝트 생성 (Phase 3)
Step 6: API_BASE URL 설정
Step 7: 관리자 페이지 구현 (Phase 4)
Step 8: Netlify 배포
Step 9: QR 일괄 생성 및 테스트
Step 10: 조합원 배포 및 교육
```

---

## 부록: 개발 시 주의사항 (Claude Code용)

### Apps Script 제한사항

| 항목 | 제한 |
|------|------|
| 실행 시간 | 6분/실행 (Web App) |
| 일일 트리거 | 20개 |
| URL Fetch | 20,000회/일 |
| Sheets 셀 수 | 10,000,000셀/시트 |
| 동시 실행 | 30명 동시 접속 가능 |
| 응답 크기 | 6MB |

### 성능 최적화 팁

1. **시트 읽기 최소화**: `getDataRange().getValues()`로 전체 읽고 메모리에서 필터링
2. **배치 쓰기**: `setValues()` 사용 (개별 `setValue()` 반복 지양)
3. **캐싱**: `CacheService`를 활용하여 자주 조회되는 설정값 캐싱
4. **인덱싱**: 사번 기준 정렬하여 이진 탐색 적용 가능

### Google Sheets 동시접속 관련

- **110명 동시 접속**: 퇴근 시간대 집중 접속 시 지연 가능
- **대안**: 퇴근 기록을 CacheService에 임시 저장 후 배치로 시트에 기록
- **현실적 시나리오**: 110명이 동시에 접속하지는 않음 (18:00~21:00 분산)

---

*문서 버전: 1.0*  
*작성일: 2025년*  
*프로젝트: KCR Overtime Tracker*
