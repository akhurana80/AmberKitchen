import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";
import { emitDriverLocation } from "../realtime";

export const trackingRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

function distanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const latDelta = from.lat - to.lat;
  const lngDelta = from.lng - to.lng;
  return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) * 111;
}

function predictDeliveryEta(distanceToPickupKm: number, distanceToDropoffKm: number, activeDriverAssigned: boolean) {
  const pickupMinutes = activeDriverAssigned ? Math.ceil((distanceToPickupKm / 24) * 60) : 8;
  const handoffMinutes = 5;
  const dropoffMinutes = Math.ceil((distanceToDropoffKm / 22) * 60);
  return Math.max(15, pickupMinutes + handoffMinutes + dropoffMinutes);
}

trackingRoutes.use(requireAuth);

trackingRoutes.post("/orders/:orderId/location", requireRole("driver", "admin"), async (req, res, next) => {
  try {
    const body = z.object({
      lat: z.number(),
      lng: z.number(),
      heading: z.number().optional(),
      speed: z.number().optional()
    }).parse(req.body);

    const result = await query(
      `insert into driver_locations (order_id, driver_id, lat, lng, heading, speed)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [req.params.orderId, req.user!.id, body.lat, body.lng, body.heading ?? null, body.speed ?? null]
    );

    emitDriverLocation(routeParam(req.params.orderId), result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

trackingRoutes.get("/orders/:orderId/location", async (req, res, next) => {
  try {
    const result = await query(
      `select * from driver_locations
       where order_id = $1
       order by created_at desc
       limit 1`,
      [req.params.orderId]
    );
    res.json(result.rows[0] ?? null);
  } catch (error) {
    next(error);
  }
});

trackingRoutes.get("/orders/:orderId/eta", async (req, res, next) => {
  try {
    const orderId = routeParam(req.params.orderId);
    const result = await query(
      `select o.id,
              o.status,
              o.delivery_lat,
              o.delivery_lng,
              o.estimated_delivery_at,
              r.lat as restaurant_lat,
              r.lng as restaurant_lng,
              dl.lat as driver_lat,
              dl.lng as driver_lng,
              dl.created_at as driver_location_at
       from orders o
       join restaurants r on r.id = o.restaurant_id
       left join lateral (
         select lat, lng, created_at
         from driver_locations
         where order_id = o.id
         order by created_at desc
         limit 1
       ) dl on true
       where o.id = $1
         and (o.customer_id = $2 or o.driver_id = $2 or $3::text in ('admin', 'super_admin', 'delivery_admin')
           or o.restaurant_id in (select id from restaurants where owner_id = $2))`,
      [orderId, req.user!.id, req.user!.role]
    );

    const order = result.rows[0];
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const restaurant = {
      lat: Number(order.restaurant_lat ?? order.delivery_lat),
      lng: Number(order.restaurant_lng ?? order.delivery_lng)
    };
    const dropoff = { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng) };
    const driver = order.driver_lat && order.driver_lng
      ? { lat: Number(order.driver_lat), lng: Number(order.driver_lng) }
      : restaurant;

    const distanceToPickupKm = distanceKm(driver, restaurant);
    const distanceToDropoffKm = distanceKm(restaurant, dropoff);
    const predictedEtaMinutes = predictDeliveryEta(distanceToPickupKm, distanceToDropoffKm, Boolean(order.driver_lat));

    await query(
      `insert into eta_prediction_events (
         order_id, predicted_eta_minutes, distance_to_pickup_km, distance_to_dropoff_km, source
       )
       values ($1, $2, $3, $4, 'eta-loop')`,
      [orderId, predictedEtaMinutes, distanceToPickupKm, distanceToDropoffKm]
    );

    res.json({
      orderId,
      status: order.status,
      predictedEtaMinutes,
      predictedDeliveryAt: new Date(Date.now() + predictedEtaMinutes * 60 * 1000).toISOString(),
      currentEstimatedDeliveryAt: order.estimated_delivery_at,
      route: {
        origin: driver,
        pickup: restaurant,
        dropoff,
        distanceToPickupKm,
        distanceToDropoffKm
      },
      driverLocationAt: order.driver_location_at
    });
  } catch (error) {
    next(error);
  }
});

trackingRoutes.get("/orders/:orderId/eta-loop", async (req, res, next) => {
  try {
    const result = await query(
      `select e.*
       from eta_prediction_events e
       join orders o on o.id = e.order_id
       where e.order_id = $1
         and (o.customer_id = $2 or o.driver_id = $2 or $3::text in ('admin', 'super_admin', 'delivery_admin')
           or o.restaurant_id in (select id from restaurants where owner_id = $2))
       order by e.created_at desc
       limit 50`,
      [routeParam(req.params.orderId), req.user!.id, req.user!.role]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
