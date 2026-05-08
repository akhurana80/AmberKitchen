import { Router } from "express";
import { requireAuth, requireRole } from "../auth";
import { query, transaction } from "../db";
import { emitOrderUpdate } from "../realtime";

export const operationsRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

operationsRoutes.use(requireAuth);

operationsRoutes.post("/analytics/jobs/demand-prediction", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await transaction(async client => {
      const job = await client.query<{ id: string }>(
        `insert into analytics_jobs (job_type, status, started_at)
         values ('ai_demand_prediction', 'running', now())
         returning id`
      );
      const jobId = job.rows[0].id;

      const predictions = await client.query(
        `with demand as (
           select coalesce(round(o.delivery_lat::numeric, 1)::text || ',' || round(o.delivery_lng::numeric, 1)::text, 'unknown') as zone_key,
                  coalesce(r.cuisine_type, 'mixed') as cuisine_type,
                  count(*) filter (where o.created_at >= now() - interval '7 days') as recent_orders,
                  count(*) filter (where o.created_at >= now() - interval '1 day') as last_day_orders
           from orders o
           left join restaurants r on r.id = o.restaurant_id
           group by zone_key, cuisine_type
         )
         insert into demand_predictions (zone_key, cuisine_type, hour_start, predicted_orders, confidence, source_job_id)
         select zone_key,
                cuisine_type,
                date_trunc('hour', now()) + interval '1 hour' as hour_start,
                greatest(1, ceil((recent_orders::numeric / 7) + (last_day_orders::numeric * 0.65)))::integer as predicted_orders,
                least(98, 55 + (recent_orders * 3) + (last_day_orders * 5))::numeric(5, 2) as confidence,
                $1
         from demand
         where recent_orders > 0 or last_day_orders > 0
         returning *`,
        [jobId]
      );

      const completed = await client.query(
        `update analytics_jobs
         set status = 'completed',
             finished_at = now(),
             summary = $2::jsonb
         where id = $1
         returning *`,
        [jobId, JSON.stringify({ predictions: predictions.rows.length })]
      );

      return { job: completed.rows[0], predictions: predictions.rows };
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

operationsRoutes.get("/analytics/jobs", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query("select * from analytics_jobs order by created_at desc limit 100");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

operationsRoutes.get("/demand-predictions", requireRole("admin", "super_admin", "delivery_admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select * from demand_predictions
       order by hour_start desc, predicted_orders desc
       limit 100`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

operationsRoutes.get("/driver-load", requireRole("delivery_admin", "admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select d.id,
              d.phone,
              d.name,
              count(o.id) filter (where o.status in ('accepted', 'ready', 'picked_up'))::integer as active_orders,
              count(o.id) filter (where o.status = 'delivered' and o.updated_at >= now() - interval '1 day')::integer as delivered_today,
              dl.lat as last_lat,
              dl.lng as last_lng,
              dl.created_at as last_location_at,
              greatest(0, 100 - (count(o.id) filter (where o.status in ('accepted', 'ready', 'picked_up')) * 25)
                + (count(o.id) filter (where o.status = 'delivered' and o.updated_at >= now() - interval '1 day') * 2))::integer as capacity_score
       from users d
       left join orders o on o.driver_id = d.id
       left join lateral (
         select lat, lng, created_at
         from driver_locations
         where driver_id = d.id
         order by created_at desc
         limit 1
       ) dl on true
       where d.role = 'driver'
       group by d.id, d.phone, d.name, dl.lat, dl.lng, dl.created_at
       order by capacity_score desc, active_orders asc, delivered_today desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

operationsRoutes.post("/orders/:orderId/assign-best-driver", requireRole("delivery_admin", "admin", "super_admin"), async (req, res, next) => {
  try {
    const orderId = routeParam(req.params.orderId);
    const result = await transaction(async client => {
      const order = await client.query(
        `select o.id, r.lat as restaurant_lat, r.lng as restaurant_lng
         from orders o
         left join restaurants r on r.id = o.restaurant_id
         where o.id = $1 for update of o`,
        [orderId]
      );
      if (!order.rows[0]) {
        return null;
      }

      const best = await client.query<{ id: string }>(
        `select d.id,
                count(o.id) filter (where o.status in ('accepted', 'ready', 'picked_up')) as active_orders,
                case
                  when dl.lat is null or dl.lng is null or $1::numeric is null or $2::numeric is null then 25
                  else sqrt(power((dl.lat - $1::numeric), 2) + power((dl.lng - $2::numeric), 2)) * 111
                end as distance_km
         from users d
         left join orders o on o.driver_id = d.id
         left join lateral (
           select lat, lng
           from driver_locations
           where driver_id = d.id
           order by created_at desc
           limit 1
         ) dl on true
         where d.role = 'driver'
         group by d.id, dl.lat, dl.lng
         order by active_orders asc, distance_km asc
         limit 1`,
        [order.rows[0].restaurant_lat ?? null, order.rows[0].restaurant_lng ?? null]
      );

      if (!best.rows[0]) {
        return null;
      }

      const updated = await client.query(
        `update orders
         set driver_id = $1, updated_at = now()
         where id = $2
         returning *`,
        [best.rows[0].id, orderId]
      );
      return updated.rows[0];
    });

    if (!result) {
      return res.status(404).json({ error: "Order or available driver not found" });
    }
    emitOrderUpdate(orderId, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
