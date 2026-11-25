const db = require('../db');

// Tính tình hình ngân sách của 1 người dùng trong 1 tháng.
// Trả về mỗi danh mục CHI: hạn mức (nếu có), đã chi, phần trăm, trạng thái.
function getBudgetOverview(userId, month) {
  const rows = db
    .prepare(
      `SELECT c.id AS category_id, c.name,
              b.id AS budget_id, b.amount AS budget,
              COALESCE((SELECT SUM(t.amount) FROM transactions t
                        WHERE t.user_id = c.user_id
                          AND t.category_id = c.id
                          AND substr(t.date, 1, 7) = ?), 0) AS spent
       FROM categories c
       LEFT JOIN budgets b
              ON b.category_id = c.id AND b.user_id = c.user_id AND b.month = ?
       WHERE c.user_id = ? AND c.type = 'expense'
       ORDER BY b.amount IS NULL, c.name`
    )
    .all(month, month, userId);

  return rows.map((r) => ({ ...r, ...budgetStatus(r.spent, r.budget) }));
}

// Từ số đã chi và hạn mức -> phần trăm + trạng thái để tô màu
//   ok      : dưới 80%   (xanh)
//   warning : 80% - 100% (vàng)
//   over    : vượt 100%  (đỏ)
function budgetStatus(spent, budget) {
  if (!budget) return { percent: null, status: 'none', remaining: null };
  const percent = Math.round((spent / budget) * 100);
  const status = percent > 100 ? 'over' : percent >= 80 ? 'warning' : 'ok';
  return { percent, status, remaining: budget - spent };
}

// Kiểm tra 1 danh mục cụ thể (dùng ngay sau khi thêm giao dịch chi)
function checkCategoryBudget(userId, categoryId, month) {
  const row = getBudgetOverview(userId, month).find((r) => r.category_id === categoryId);
  return row && row.budget ? row : null;
}

module.exports = { getBudgetOverview, checkCategoryBudget };
