/**
 * GPS.gs - 위치 검증
 * Haversine 공식으로 사무실 반경 확인
 */

function verifyGPS(lat, lng) {
  var oLat = parseFloat(getSettingValue('office_lat'));
  var oLng = parseFloat(getSettingValue('office_lng'));
  var rad  = parseFloat(getSettingValue('office_radius_m')) || 500;
  return _haversine(lat, lng, oLat, oLng) <= rad;
}

function _haversine(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
