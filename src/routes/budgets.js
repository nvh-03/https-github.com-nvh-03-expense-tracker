const express = require('express');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const { currentMonth } = require('../utils/format');
const { getBudgetOverview } = require('../utils/budget');

const router = express.Router();
router.use('/budgets', requireLogin);

const isMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '');

// "2026-11" -> "2026-10"
function previousMonth(month) {
  let [y, m] = month.split('-').map(Number);
  m -= 1;
  if (m === 0) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// ---------- XEM NGÂN SÁCH THEO THÁNG ----------
router.get('/budgets', (req, res) => {
  const month = isMonth(req.query.month) ? req.query.month : currentMonth();
  const rows = getBudgetOverview(req.session.userId, month);

  // Tổng của những danh mục CÓ đặt ngân sách
  const withBudget = rows.filter((r) => r.budget);
  const totalBudget = withBudget.reduce((s, r) => s + r.budget, 0);
  const totalSpent = withBudget.reduce((s, r) => s + r.spent, 0);

  res.render('budgets', { month, rows, totalBudget, totalSpent });
});

// ---------- ĐẶT / SỬA / XOÁ HẠN MỨC ----------
// Một form cho cả 3 việc: nhập số > 0 để đặt hoặc sửa, để trống (hoặc 0) để xoá.
router.post('/budgets', (req, res) => {
  const userId = req.session.userId;
  const month = req.body.month;
  const back = '/budgets?month=' + (isMonth(month) ? month : currentMonth());

  // Danh mục phải là danh mục CHI của chính người dùng này
  const category = db
    .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ? AND type = 'expense'")
    .get(req.body.category_id, userId);
  if (!category || !isMonth(month)) {
    req.flash('danger', 'Dữ liệu không hợp lệ.');
    return res.redirect(back);
  }

  const raw = String(req.body.amount || '').replace(/[.,\s]/g, '');
  const amount = raw === '' ? 0 : Number(raw);
  if (!Number.isInteger(amount) || amount < 0) {
    req.flash('danger', 'Hạn mức phải là số nguyên không âm.');
    return res.redirect(back);
  }

  if (amount === 0) {
    db.prepare('DELETE FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?').run(
      userId, category.id, month
    );
    req.flash('success', `Đã bỏ ngân sách "${category.name}".`);
  } else {
    // "UPSERT": chưa có thì thêm, có rồi thì cập nhật.
    // Dựa vào ràng buộc UNIQUE(user_id, category_id, month) trong db.js
    db.prepare(
      `INSERT INTO budgets (user_id, category_id, month, amount) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, category_id, month) DO UPDATE SET amount = excluded.amount`
    ).run(userId, category.id, month, amount);
    req.flash('success', `Đã lưu ngân sách "${category.name}".`);
  }
  res.redirect(back);
});

// ---------- SAO CHÉP TỪ THÁNG TRƯỚC ----------
// Tiện cho người dùng: mỗi tháng không phải nhập lại từ đầu
router.post('/budgets/copy', (req, res) => {
  const userId = req.session.userId;
  const month = isMonth(req.body.month) ? req.body.month : currentMonth();
  const prev = previousMonth(month);

  // INSERT ... SELECT: chép hàng loạt; "ON CONFLICT DO NOTHING" bỏ qua danh mục đã đặt rồi
  const result = db
    .prepare(
      `INSERT INTO budgets (user_id, category_id, month, amount)
       SELECT user_id, category_id, ?, amount FROM budgets
       WHERE user_id = ? AND month = ?
       ON CONFLICT (user_id, category_id, month) DO NOTHING`
    )
    .run(month, userId, prev);

  if (result.changes > 0) {
    req.flash('success', `Đã sao chép ${result.changes} ngân sách từ tháng ${prev.split('-').reverse().join('/')}.`);
  } else {
    req.flash('warning', 'Tháng trước không có ngân sách mới nào để sao chép.');
  }
  res.redirect('/budgets?month=' + month);
});

module.exports = router;
