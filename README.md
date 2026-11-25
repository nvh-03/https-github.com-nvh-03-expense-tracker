# Expense Tracker - Quản lý chi tiêu cá nhân

Ứng dụng web giúp theo dõi thu nhập, chi tiêu, danh mục, ngân sách và báo cáo tài chính.
Mỗi người dùng chỉ thấy dữ liệu của chính mình.

## Công nghệ
- Node.js (>= 22.13) + Express
- EJS (giao diện) + Bootstrap
- SQLite (module `node:sqlite` có sẵn trong Node)
- express-session + bcryptjs (đăng nhập, mã hoá mật khẩu)

## Cách chạy
```bash
npm install      # cài thư viện (chỉ cần làm 1 lần)
npm run dev      # chạy và tự khởi động lại khi sửa code
```
Mở trình duyệt: http://localhost:3000

## Cấu trúc thư mục
```
src/
  server.js           # điểm khởi động ứng dụng
  db.js               # kết nối và tạo bảng SQLite
  middleware/auth.js  # kiểm tra đăng nhập
  routes/             # xử lý từng nhóm đường dẫn (URL)
views/                # giao diện EJS
public/               # CSS, ảnh
data/                 # file database (không đưa lên Git)
```

## Biến môi trường
| Tên | Ý nghĩa | Mặc định |
|---|---|---|
| `PORT` | Cổng chạy web | `3000` (nền tảng hosting tự đặt) |
| `NODE_ENV` | Đặt `production` khi chạy trên Internet | (trống) |
| `SESSION_SECRET` | Chuỗi bí mật ký cookie, **bắt buộc** khi production | chuỗi mặc định cho máy cá nhân |
| `DATABASE_PATH` | Đường dẫn file SQLite | `data/expense.db` |

Tạo chuỗi bí mật ngẫu nhiên:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Triển khai lên Railway
1. Đưa code lên GitHub (thư mục `node_modules` và file database đã được `.gitignore` bỏ qua).
2. Vào railway.com → New Project → Deploy from GitHub repo → chọn repo này.
3. Trong service: **Variables** → thêm `NODE_ENV`, `SESSION_SECRET`, `DATABASE_PATH=/data/expense.db`.
4. Chuột phải vào service → **Attach Volume**, mount path là `/data` (để dữ liệu không mất khi deploy lại).
5. **Settings → Networking → Generate Domain** để có địa chỉ web dạng `xxx.up.railway.app`.
