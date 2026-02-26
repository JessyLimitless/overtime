/**
 * GPS.gs - 위치 검증
 * Haversine 공식으로 사무실 반경 내 접속 여부 확인
 */

function verifyGPS(lat, lng) {
  var officeLat = parseFloat(getSettingValue('office_lat'));
  var officeLng = parseFloat(getSettingValue('office_lng'));
  var radiusM   = parseFloat(getSettingValue('office_radius_m')) || 500;

  return haversineDistance(lat, lng, officeLat, officeLng) <= radiusM;
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  var R    = 6371000;
  var dLat = _toRad(lat2 - lat1);
  var dLng = _toRad(lng2 - lng1);

  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(_toRad(lat1)) * Math.cos(_toRad(lat2)) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _toRad(deg) { return deg * Math.PI / 180; }
