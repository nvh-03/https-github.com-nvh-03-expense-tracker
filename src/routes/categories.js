const express = require('express');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Mọi đường dẫn trong file này đều cần đăng nhập
router.use('/categories', requireLogin);

const TYPES = ['income', 'expense'];

// Hàm tiện ích: tìm danh mục THEO ID VÀ USER_ID.
// Nếu thiếu điều kiện user_id, người A có thể sửa danh mục của người B
// chỉ bằng cách đổi số id trên URL. Đây là lỗi bảo mật rất phổ biến!
function findOwnCategory(id, userId) {
  return db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
}

// ---------- DANH SÁCH ----------
router.get('/categories', (req, res) => {
  // LEFT JOIN + COUNT để biết mỗi danh mục đang có bao nhiêu giao dịch
  const categories = db
    .prepare(
      `SELECT c.id, c.name, c.type, COUNT(t.id) AS tx_count
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.type, c.name`
    )
    .all(req.session.userId);

  res.render('categories', {
    income: categories.filter((c) => c.type === 'income'),
    expense: categories.filter((c) => c.type === 'expense'),
  });
});

// ---------- THÊM ----------
router.post('/categories', (req, res) => {
  const name = (req.body.name || '').trim();
  const type = req.body.type;

  if (!name || name.length > 50 || !TYPES.includes(type)) {
    req.flash('danger', 'Tên danh mục không hợp lệ (1-50 ký tự).');
    return res.redirect('/categories');
  }

  try {
    db.prepare('INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)').run(
      req.session.userId,
      name,
      type
    );
    req.flash('success', `Đã thêm danh mục "${name}".`);
  } catch (err) {
    // Vi phạm UNIQUE(user_id, name, type) => trùng tên
    req.flash('danger', `Danh mục "${name}" đã tồn tại.`);
  }
  res.redirect('/categories');
});

// ---------- ĐỔI TÊN ----------
router.post('/categories/:id/edit', (req, res) => {
  const category = findOwnCategory(req.params.id, req.session.userId);
  if (!category) {
    req.flash('danger', 'Không tìm thấy danh mục.');
    return res.redirect('/categories');
  }

  const name = (req.body.name || '').trim();
  if (!name || name.length > 50) {
    req.flash('danger', 'Tên danh mục không hợp lệ (1-50 ký tự).');
    return res.redirect('/categories');
  }

  try {
    db.prepare('UPDATE categories SET name = ? WHERE id = ? AND user_id = ?').run(
      name,
      category.id,
      req.session.userId
    );
    req.flash('success', `Đã đổi tên thành "${name}".`);
  } catch (err) {
    req.flash('danger', `Danh mục "${name}" đã tồn tại.`);
  }
  res.redirect('/categories');
});

// ---------- XOÁ ----------
router.post('/categories/:id/delete', (req, res) => {
  const category = findOwnCategory(req.params.id, req.session.userId);
  if (!category) {
    req.flash('danger', 'Không tìm thấy danh mục.');
    return res.redirect('/categories');
  }

  // Không cho xoá danh mục đang có giao dịch, tránh mất dữ liệu
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM transactions WHERE category_id = ? AND user_id = ?')
    .get(category.id, req.session.userId);
  if (count > 0) {
    req.flash('warning', `Không thể xoá "${category.name}" vì đang có ${count} giao dịch.`);
    return res.redirect('/categories');
  }

  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(category.id, req.session.userId);
  req.flash('success', `Đã xoá danh mục "${category.name}".`);
  res.redirect('/categories');
});

module.exports = router;
