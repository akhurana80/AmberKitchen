import { Router } from "express";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole("admin", "super_admin"));

adminRoutes.get("/dashboard", async (_req, res, next) => {
  try {
    const [users, orders, revenue, payments, recentOrders] = await Promise.all([
      query<{ count: string }>("select count(*) from users"),
      query<{ status: string; count: string }>("select status, count(*) from orders group by status order by status"),
      query<{ total_paise: string | null }>("select coalesce(sum(total_paise), 0) as total_paise from orders where status <> 'cancelled'"),
      query<{ provider: string; status: string; count: string }>(
        "select provider, status, count(*) from payments group by provider, status order by provider, status"
      ),
      query<{ id: string; status: string; total_paise: number; created_at: string; restaurant_name: string }>(
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

adminRoutes.get("/orders", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query<{ provider: string; status: string; transactions: string; amount_paise: string }>(
      `select o.*, r.name as restaurant_name, u.phone as customer_phone, d.phone as driver_phone
       from orders o
       left join restaurants r on r.id = o.restaurant_id
       left join users u on u.id = o.customer_id
       left join users d on d.id = o.driver_id
       order by o.created_at desc
       limit 200`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/users", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select id, phone, email, name, role, created_at, updated_at
       from users
       order by created_at desc
       limit 200`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/users/:id/role", requireRole("super_admin"), async (req, res, next) => {
  try {
    const role = String(req.body.role);
    const result = await query(
      `update users set role = $1::user_role, updated_at = now()
       where id = $2
       returning id, phone, email, name, role`,
      [role, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/restaurants", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select r.*, u.phone as owner_phone, u.email as owner_email
       from restaurants r
       left join users u on u.id = r.owner_id
       order by r.created_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/restaurants/:id/approval", requireRole("super_admin"), async (req, res, next) => {
  try {
    const status = String(req.body.status);
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid restaurant approval status" });
    }

    const result = await query(
      `update restaurants
       set approval_status = $1,
           onboarding_status = case
             when $1 = 'approved' then 'approved'
             when $1 = 'rejected' then 'rejected'
             else onboarding_status
           end
       where id = $2
       returning *`,
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/payment-reports", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select provider, status, count(*) as transactions, coalesce(sum(amount_paise), 0) as amount_paise
       from payments
       group by provider, status
       order by provider, status`
    );
    res.json(result.rows.map(row => ({
      ...row,
      transactions: Number(row.transactions),
      amount_paise: Number(row.amount_paise)
    })));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/analytics", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const [dailyOrders, topRestaurants, driverStats] = await Promise.all([
      query<{ day: string; orders: string; revenue_paise: string }>(
        `select date_trunc('day', created_at) as day, count(*) as orders, coalesce(sum(total_paise), 0) as revenue_paise
         from orders
         group by day
         order by day desc
         limit 30`
      ),
      query<{ name: string; orders: string; revenue_paise: string }>(
        `select r.name, count(o.id) as orders, coalesce(sum(o.total_paise), 0) as revenue_paise
         from restaurants r
         left join orders o on o.restaurant_id = r.id
         group by r.id, r.name
         order by revenue_paise desc
         limit 10`
      ),
      query<{ id: string; phone: string; deliveries: string }>(
        `select d.id, d.phone, count(o.id) as deliveries
         from users d
         left join orders o on o.driver_id = d.id and o.status = 'delivered'
         where d.role = 'driver'
         group by d.id, d.phone
         order by deliveries desc
         limit 10`
      )
    ]);

    res.json({
      dailyOrders: dailyOrders.rows,
      topRestaurants: topRestaurants.rows,
      driverStats: driverStats.rows
    });
  } catch (error) {
    next(error);
  }
});
