// "Flash message" = thông báo hiện ra 1 lần sau khi chuyển trang
// (ví dụ: "Đã thêm danh mục"). Lưu tạm trong session, đọc xong thì xoá.
function flash(req, res, next) {
  // Gọi req.flash('success', 'Nội dung') để tạo thông báo
  req.flash = (type, message) => {
    req.session.flash = { type, message };
  };
  // Đưa thông báo ra giao diện rồi xoá khỏi session
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

module.exports = flash;
