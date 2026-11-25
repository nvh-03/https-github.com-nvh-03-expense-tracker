const express = require('express');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const { currentMonth, today, formatMoney } = require('../utils/format');
const { checkCategoryBudget } = require('../utils/budget');

const router = express.Router();
router.use('/transactions', requireLogin);

// ---------- HÀM TIỆN ÍCH ----------

// Lấy danh mục của người dùng, chia theo loại để hiện trong ô chọn
function getCategories(userId) {
  return db
    .prepare('SELECT id, name, type FROM categories WHERE user_id = ? ORDER BY type, name')
    .all(userId);
}

// Tìm giao dịch theo id, CHỈ khi nó thuộc về người dùng này (chống IDOR)
function findOwnTransaction(id, userId) {
  return db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
}

// Kiểm tra dữ liệu form. Trả về { errors, data }
function validate(body, userId) {
  const errors = [];

  // Số tiền: cho phép gõ "1.500.000" hoặc "1500000" -> bỏ dấu chấm, phẩy, khoảng trắng
  const amount = Number(String(body.amount || '').replace(/[.,\s]/g, ''));
  if (!Number.isInteger(amount) || amount <= 0) {
    errors.push('Số tiền phải là số nguyên lớn hơn 0.');
  }

  // Ngày: đúng dạng YYYY-MM-DD và là ngày có thật.
  // Mẹo: tạo Date rồi đổi ngược lại thành chuỗi; nếu khác chuỗi gốc
  // (VD "2026-02-31" bị JS tự đổi thành 03/03) thì ngày đó không tồn tại.
  const date = body.date || '';
  const parsed = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsed) || parsed.toISOString().slice(0, 10) !== date) {
    errors.push('Ngày không hợp lệ.');
  }

  // Danh mục phải thuộc về chính người dùng này
  const category = db
    .prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
    .get(body.category_id, userId);
  if (!category) {
    errors.push('Vui lòng chọn danh mục.');
  }

  const note = (body.note || '').trim();
  if (note.length > 200) {
    errors.push('Ghi chú tối đa 200 ký tự.');
  }

  return {
    errors,
    // Loại (thu/chi) lấy theo danh mục, người dùng không cần chọn 2 lần
    data: { amount, date, note, category_id: category?.id, type: category?.type },
  };
}

// Sau khi lưu giao dịch CHI: nếu danh mục có ngân sách thì báo tình hình
function budgetMessage(userId, data, fallback) {
  if (data.type !== 'expense') return ['success', fallback];
  const b = checkCategoryBudget(userId, data.category_id, data.date.slice(0, 7));
  if (!b) return ['success', fallback];
  if (b.status === 'over') {
    return ['danger', `${fallback} ⚠️ Danh mục này đã VƯỢT ngân sách ${formatMoney(-b.remaining)} (${b.percent}%).`];
  }
  if (b.status === 'warning') {
    return ['warning', `${fallback} Danh mục này đã dùng ${b.percent}% ngân sách, còn ${formatMoney(b.remaining)}.`];
  }
  return ['success', fallback];
}

// ---------- DANH SÁCH + BỘ LỌC ----------
router.get('/transactions', (req, res) => {
  const userId = req.session.userId;
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : currentMonth();
  const type = ['income', 'expense'].includes(req.query.type) ? req.query.type : '';
  const categoryId = req.query.category_id ? Number(req.query.category_id) : '';

  // Ghép câu SQL theo bộ lọc. Giá trị luôn truyền qua dấu "?"
  // (KHÔNG cộng chuỗi trực tiếp) để chống tấn công SQL Injection.
  let sql = `
    SELECT t.*, c.name AS category_name
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ? AND substr(t.date, 1, 7) = ?`;
  const params = [userId, month];
  if (type) {
    sql += ' AND t.type = ?';
    params.push(type);
  }
  if (categoryId) {
    sql += ' AND t.category_id = ?';
    params.push(categoryId);
  }
  sql += ' ORDER BY t.date DESC, t.id DESC';

  const transactions = db.prepare(sql).all(...params);

  // Tính tổng ngay trong JavaScript
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  res.render('transactions/index', {
    transactions,
    categories: getCategories(userId),
    filters: { month, type, categoryId },
    totalIncome,
    totalExpense,
  });
});

// ---------- THÊM ----------
router.get('/transactions/new', (req, res) => {
  res.render('transactions/form', {
    title: 'Thêm giao dịch',
    action: '/transactions',
    categories: getCategories(req.session.userId),
    tx: { date: today(), category_id: Number(req.query.category_id) || '' },
    errors: [],
  });
});

router.post('/transactions', (req, res) => {
  const userId = req.session.userId;
  const { errors, data } = validate(req.body, userId);

  if (errors.length) {
    return res.status(400).render('transactions/form', {
      title: 'Thêm giao dịch',
      action: '/transactions',
      categories: getCategories(userId),
      tx: req.body, // giữ lại dữ liệu đã nhập để người dùng không phải gõ lại
      errors,
    });
  }

  db.prepare(
    'INSERT INTO transactions (user_id, category_id, type, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, data.category_id, data.type, data.amount, data.date, data.note);

  req.flash(...budgetMessage(userId, data, 'Đã thêm giao dịch.'));
  res.redirect('/transactions?month=' + data.date.slice(0, 7));
});

// ---------- SỬA ----------
router.get('/transactions/:id/edit', (req, res) => {
  const tx = findOwnTransaction(req.params.id, req.session.userId);
  if (!tx) {
    req.flash('danger', 'Không tìm thấy giao dịch.');
    return res.redirect('/transactions');
  }
  res.render('transactions/form', {
    title: 'Sửa giao dịch',
    action: `/transactions/${tx.id}/edit`,
    categories: getCategories(req.session.userId),
    tx,
    errors: [],
  });
});

router.post('/transactions/:id/edit', (req, res) => {
  const userId = req.session.userId;
  const tx = findOwnTransaction(req.params.id, userId);
  if (!tx) {
    req.flash('danger', 'Không tìm thấy giao dịch.');
    return res.redirect('/transactions');
  }

  const { errors, data } = validate(req.body, userId);
  if (errors.length) {
    return res.status(400).render('transactions/form', {
      title: 'Sửa giao dịch',
      action: `/transactions/${tx.id}/edit`,
      categories: getCategories(userId),
      tx: { ...req.body, id: tx.id },
      errors,
    });
  }

  db.prepare(
    `UPDATE transactions SET category_id = ?, type = ?, amount = ?, date = ?, note = ?
     WHERE id = ? AND user_id = ?`
  ).run(data.category_id, data.type, data.amount, data.date, data.note, tx.id, userId);

  req.flash(...budgetMessage(userId, data, 'Đã cập nhật giao dịch.'));
  res.redirect('/transactions?month=' + data.date.slice(0, 7));
});

// ---------- XOÁ ----------
router.post('/transactions/:id/delete', (req, res) => {
  const tx = findOwnTransaction(req.params.id, req.session.userId);
  if (!tx) {
    req.flash('danger', 'Không tìm thấy giao dịch.');
    return res.redirect('/transactions');
  }
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(tx.id, req.session.userId);
  req.flash('success', 'Đã xoá giao dịch.');
  res.redirect('/transactions?month=' + tx.date.slice(0, 7));
});

module.exports = router;
