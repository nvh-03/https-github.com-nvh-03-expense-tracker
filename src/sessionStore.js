// Nơi lưu session trong bảng "sessions" của SQLite.
// Mặc định express-session lưu trong RAM (MemoryStore): mỗi lần máy chủ
// khởi động lại thì mọi người bị đăng xuất, và nó không dành cho môi trường thật.
const session = require('express-session');
const db = require('./db');

const ONE_DAY = 1000 * 60 * 60 * 24;

class SQLiteStore extends session.Store {
  constructor() {
    super();
    // Dọn session hết hạn mỗi giờ. unref() để bộ hẹn giờ không giữ tiến trình lại.
    setInterval(() => this.cleanup(), 1000 * 60 * 60).unref();
  }

  // Lấy session theo mã (sid)
  get(sid, callback) {
    try {
      const row = db.prepare('SELECT data, expires FROM sessions WHERE sid = ?').get(sid);
      if (!row || row.expires < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  // Lưu (thêm hoặc cập nhật) session
  set(sid, sess, callback) {
    try {
      const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + ONE_DAY;
      db.prepare(
        `INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)
         ON CONFLICT (sid) DO UPDATE SET data = excluded.data, expires = excluded.expires`
      ).run(sid, JSON.stringify(sess), expires);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  // Xoá session (khi đăng xuất)
  destroy(sid, callback) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  // Gia hạn thời gian sống của session khi người dùng còn hoạt động
  touch(sid, sess, callback) {
    this.set(sid, sess, callback);
  }

  cleanup() {
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  }
}

module.exports = SQLiteStore;
