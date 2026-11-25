// Middleware = hàm chạy "chen giữa" trước khi tới route.
// requireLogin: chặn người chưa đăng nhập, đưa họ về trang /login.
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

// requireGuest: người đã đăng nhập thì không cần vào /login, /register nữa.
function requireGuest(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/');
  }
  next();
}

module.exports = { requireLogin, requireGuest };
