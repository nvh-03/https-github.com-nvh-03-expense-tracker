// Các hàm tiện ích dùng chung cho giao diện

// 1500000 -> "1.500.000 ₫"
function formatMoney(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' ₫';
}

// "2026-11-25" -> "25/11/2026"
function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// Tháng hiện tại dạng "2026-11" (theo giờ máy tính)
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Ngày hôm nay dạng "2026-11-25"
function today() {
  const now = new Date();
  return `${currentMonth()}-${String(now.getDate()).padStart(2, '0')}`;
}

// Đổi dữ liệu thành JSON an toàn để nhúng vào thẻ <script> trong EJS
function safeJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

module.exports = { formatMoney, formatDate, currentMonth, today, safeJson };
