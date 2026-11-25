const express = require('express');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const { currentMonth } = require('../utils/format');
const { getBudgetOverview } = require('../utils/budget');

const router = express.Router();

// Trang tổng quan: tổng thu/chi tháng này + 5 giao dịch gần nhất.
// Phần 5 sẽ bổ sung biểu đồ.
router.get('/', requireLogin, (req, res) => {
  const userId = req.session.userId;
  const month = currentMonth();

  // SUM + CASE: tính tổng thu và tổng chi trong 1 câu SQL
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
       FROM transactions
       WHERE user_id = ? AND substr(date, 1, 7) = ?`
    )
    .get(userId, month);

  const recent = db
    .prepare(
      `SELECT t.*, c.name AS category_name
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ?
       ORDER BY t.date DESC, t.id DESC
       LIMIT 5`
    )
    .all(userId);

  // Chỉ lấy các ngân sách đang ở mức cảnh báo hoặc đã vượt
  const budgetAlerts = getBudgetOverview(userId, month).filter(
    (b) => b.status === 'warning' || b.status === 'over'
  );

  res.render('dashboard', { month, totals, recent, budgetAlerts });
});

module.exports = router;
