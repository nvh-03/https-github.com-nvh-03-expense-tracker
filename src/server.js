const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const categoryRoutes = require('./routes/categories');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const reportRoutes = require('./routes/reports');
const flash = require('./middleware/flash');
const SQLiteStore = require('./sessionStore');
const { formatMoney, formatDate, safeJson } = require('./utils/format');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CẤU HÌNH THEO MÔI TRƯỜNG ----------
// NODE_ENV=production khi chạy trên Internet, còn trên máy bạn thì không đặt.
const isProduction = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'chi-dung-khi-chay-tren-may-ca-nhan';

// Trên Internet BẮT BUỘC có chuỗi bí mật riêng, nếu không ai cũng có thể giả mạo cookie
if (isProduction && !process.env.SESSION_SECRET) {
  console.error('LỖI: Cần đặt biến môi trường SESSION_SECRET khi chạy production.');
  process.exit(1);
}

// Nền tảng hosting đứng trước app như một "proxy" xử lý HTTPS.
// Dòng này giúp Express biết request gốc là HTTPS, để cookie secure hoạt động.
if (isProduction) {
  app.set('trust proxy', 1);
}

// Cấu hình giao diện EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Hàm định dạng dùng được ở mọi trang EJS
app.locals.formatMoney = formatMoney;
app.locals.formatDate = formatDate;
app.locals.safeJson = safeJson;

// Đọc dữ liệu từ form HTML (req.body)
app.use(express.urlencoded({ extended: false }));
// File tĩnh: CSS, ảnh...
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session: ghi nhớ ai đang đăng nhập thông qua cookie, lưu trong SQLite
app.use(
  session({
    store: new SQLiteStore(),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,        // JavaScript trên trình duyệt không đọc được cookie (chống đánh cắp qua XSS)
      sameSite: 'lax',       // trang web khác không gửi form "giả" tới app của bạn được (chống CSRF)
      secure: isProduction,  // khi deploy: cookie chỉ gửi qua HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 ngày
    },
  })
);

// Cho mọi trang EJS biết người đang đăng nhập là ai
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId
    ? { id: req.session.userId, name: req.session.userName }
    : null;
  next();
});

app.use(flash);

// Đường dẫn để nền tảng hosting kiểm tra app còn sống không
app.get('/healthz', (req, res) => res.send('ok'));

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(categoryRoutes);
app.use(transactionRoutes);
app.use(budgetRoutes);
app.use(reportRoutes);

// Trang 404
app.use((req, res) => {
  res.status(404).send('Không tìm thấy trang');
});

app.listen(PORT, () => {
  console.log(`Expense Tracker đang chạy tại http://localhost:${PORT}`);
});
