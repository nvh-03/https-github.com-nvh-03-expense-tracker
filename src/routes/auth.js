const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireGuest } = require('../middleware/auth');

const router = express.Router();

// Danh mục mặc định tạo sẵn cho mỗi người dùng mới
const DEFAULT_CATEGORIES = [
  ['Lương', 'income'],
  ['Thưởng', 'income'],
  ['Thu nhập khác', 'income'],
  ['Ăn uống', 'expense'],
  ['Đi lại', 'expense'],
  ['Nhà ở', 'expense'],
  ['Mua sắm', 'expense'],
  ['Giải trí', 'expense'],
  ['Sức khoẻ', 'expense'],
  ['Khác', 'expense'],
];

// ---------- ĐĂNG KÝ ----------
router.get('/register', requireGuest, (req, res) => {
  res.render('register', { error: null, form: {} });
});

router.post('/register', requireGuest, (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const confirm = req.body.confirm || '';
  const form = { name, email };

  // 1. Kiểm tra dữ liệu nhập vào
  if (!name || !email || !password) {
    return res.status(400).render('register', { error: 'Vui lòng nhập đầy đủ thông tin.', form });
  }
  if (password.length < 6) {
    return res.status(400).render('register', { error: 'Mật khẩu phải có ít nhất 6 ký tự.', form });
  }
  if (password !== confirm) {
    return res.status(400).render('register', { error: 'Mật khẩu nhập lại không khớp.', form });
  }

  // 2. Email đã tồn tại chưa?
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).render('register', { error: 'Email này đã được đăng ký.', form });
  }

  // 3. Mã hoá mật khẩu rồi mới lưu (không bao giờ lưu mật khẩu gốc)
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email, passwordHash);
  const userId = Number(result.lastInsertRowid);

  // 4. Tạo danh mục mặc định cho người dùng này
  const insertCat = db.prepare('INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)');
  for (const [catName, type] of DEFAULT_CATEGORIES) {
    insertCat.run(userId, catName, type);
  }

  // 5. Đăng nhập luôn sau khi đăng ký
  req.session.userId = userId;
  req.session.userName = name;
  res.redirect('/');
});

// ---------- ĐĂNG NHẬP ----------
router.get('/login', requireGuest, (req, res) => {
  res.render('login', { error: null, form: {} });
});

router.post('/login', requireGuest, (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  // So sánh mật khẩu nhập vào với bản đã mã hoá trong DB.
  // Thông báo lỗi chung chung để kẻ xấu không đoán được email nào tồn tại.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).render('login', { error: 'Email hoặc mật khẩu không đúng.', form: { email } });
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  res.redirect('/');
});

// ---------- ĐĂNG XUẤT ----------
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
