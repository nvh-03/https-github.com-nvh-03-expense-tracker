// Kết nối cơ sở dữ liệu SQLite.
// Dùng module "node:sqlite" có sẵn trong Node.js (>= 22.13), không cần cài thêm gì.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

// Vị trí file database: lấy từ biến môi trường DATABASE_PATH (khi deploy),
// nếu không có thì dùng data/expense.db (khi chạy trên máy bạn).
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'expense.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true }); // tạo thư mục nếu chưa có
const db = new DatabaseSync(dbPath);

// WAL: chế độ ghi an toàn và nhanh hơn khi nhiều người dùng cùng lúc
db.exec('PRAGMA journal_mode = WAL;');

// Bật kiểm tra khoá ngoại (mặc định SQLite tắt)
db.exec('PRAGMA foreign_keys = ON;');

// Tạo 4 bảng nếu chưa có. Bảng nào cũng có user_id để tách dữ liệu từng người.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT    NOT NULL,
    type    TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    UNIQUE (user_id, name, type)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    type        TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    amount      INTEGER NOT NULL CHECK (amount > 0),
    date        TEXT    NOT NULL,
    note        TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Lưu phiên đăng nhập (session) để khởi động lại máy chủ không bị đăng xuất
  CREATE TABLE IF NOT EXISTS sessions (
    sid     TEXT    PRIMARY KEY,
    data    TEXT    NOT NULL,
    expires INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month       TEXT    NOT NULL,
    amount      INTEGER NOT NULL CHECK (amount > 0),
    UNIQUE (user_id, category_id, month)
  );
`);

module.exports = db;
