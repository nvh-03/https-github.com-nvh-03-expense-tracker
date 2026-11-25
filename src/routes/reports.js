const express = require('express');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const { currentMonth } = require('../utils/format');

const router = express.Router();
router.use('/reports', requireLogin);

const isMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '');

// Danh sách N tháng kết thúc ở `month`. VD lastMonths("2026-02", 3) -> ["2025-12","2026-01","2026-02"]
function lastMonths(month, n) {
  let [y, m] = month.split('-').map(Number);
  const result = [];
  for (let i = 0; i < n; i++) {
    result.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return result;
}

// Chi tiêu theo danh mục trong 1 tháng (GROUP BY = gom nhóm rồi cộng)
function expenseByCategory(userId, month) {
  return db
    .prepare(
      `SELECT c.name, SUM(t.amount) AS total, COUNT(*) AS count
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.type = 'expense' AND substr(t.date, 1, 7) = ?
       GROUP BY c.id
       ORDER BY total DESC`
    )
    .all(userId, month);
}

// Tổng thu / chi của từng tháng trong khoảng [from, to]
function monthlyTotals(userId, months) {
  const rows = db
    .prepare(
      `SELECT substr(date, 1, 7) AS month,
              COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
       FROM transactions
       WHERE user_id = ? AND substr(date, 1, 7) BETWEEN ? AND ?
       GROUP BY month`
    )
    .all(userId, months[0], months[months.length - 1]);

  // Tháng không có giao dịch thì SQL không trả về -> tự điền số 0
  return months.map((m) => rows.find((r) => r.month === m) || { month: m, income: 0, expense: 0 });
}

// ---------- TRANG BÁO CÁO ----------
router.get('/reports', (req, res) => {
  const userId = req.session.userId;
  const month = isMonth(req.query.month) ? req.query.month : currentMonth();

  const byCategory = expenseByCategory(userId, month);
  const history = monthlyTotals(userId, lastMonths(month, 6));
  const current = history[history.length - 1];

  // Tỷ lệ tiết kiệm = (thu - chi) / thu
  const savingRate = current.income > 0
    ? Math.round(((current.income - current.expense) / current.income) * 100)
    : null;

  // Thu nhập theo danh mục (bảng nhỏ)
  const incomeByCategory = db
    .prepare(
      `SELECT c.name, SUM(t.amount) AS total
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.type = 'income' AND substr(t.date, 1, 7) = ?
       GROUP BY c.id ORDER BY total DESC`
    )
    .all(userId, month);

  res.render('reports', { month, current, savingRate, byCategory, incomeByCategory, history });
});

// ---------- XUẤT CSV (mở được bằng Excel) ----------
router.get('/reports/export.csv', (req, res) => {
  const month = isMonth(req.query.month) ? req.query.month : currentMonth();
  const rows = db
    .prepare(
      `SELECT t.date, t.type, c.name AS category, t.amount, t.note
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND substr(t.date, 1, 7) = ?
       ORDER BY t.date, t.id`
    )
    .all(req.session.userId, month);

  // Bọc mỗi ô trong dấu ngoặc kép, nhân đôi dấu " bên trong (chuẩn CSV)
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Ngày', 'Loại', 'Danh mục', 'Số tiền', 'Ghi chú'].map(cell).join(',')];
  for (const r of rows) {
    lines.push([r.date, r.type === 'income' ? 'Thu' : 'Chi', r.category, r.amount, r.note].map(cell).join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="giao-dich-${month}.csv"`);
  // "﻿" (BOM) giúp Excel nhận đúng tiếng Việt có dấu
  res.send('﻿' + lines.join('\r\n'));
});

module.exports = router;
