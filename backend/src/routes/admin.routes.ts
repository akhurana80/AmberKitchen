import { Router } from "express";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole("admin"));

adminRoutes.get("/dashboard", async (_req, res, next) => {
  try {
    const [users, orders, revenue, payments, recentOrders] = await Promise.all([
      query<{ count: string }>("select count(*) from users"),
      query<{ status: string; count: string }>("select status, count(*) from orders group by status order by status"),
      query<{ total_paise: string | null }>("select coalesce(sum(total_paise), 0) as total_paise from orders where status <> 'cancelled'"),
      query<{ provider: string; status: string; count: string }>(
        "select provider, status, count(*) from payments group by provider, status order by provider, status"
      ),
      query(
        `select o.id, o.status, o.total_paise, o.created_at, r.name as restaurant_name
         from orders o
         left join restaurants r on r.id = o.restaurant_id
         order by o.created_at desc
         limit 10`
      )
    ]);

    res.json({
      users: Number(users.rows[0]?.count ?? 0),
      ordersByStatus: orders.rows.map(row => ({ status: row.status, count: Number(row.count) })),
      revenuePaise: Number(revenue.rows[0]?.total_paise ?? 0),
      payments: payments.rows.map(row => ({
        provider: row.provider,
        status: row.status,
        count: Number(row.count)
      })),
      recentOrders: recentOrders.rows
    });
  } catch (error) {
    next(error);
  }
});
