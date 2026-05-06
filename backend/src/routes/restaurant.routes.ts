import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";
import { emitOrderUpdate } from "../realtime";
import { searchDelhiNcrRestaurants } from "../services/google-places.service";

export const restaurantRoutes = Router();

function etaMinutes(distanceKm: number, activeOrders: number) {
  const prepMinutes = 18 + Math.min(activeOrders, 8) * 2;
  const travelMinutes = Math.ceil((distanceKm / 22) * 60);
  return Math.max(20, prepMinutes + travelMinutes);
}

const menuItemInput = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  pricePaise: z.number().int().positive(),
  photoUrl: z.string().url().optional(),
  isVeg: z.boolean().optional(),
  cuisineType: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  googlePlaceId: z.string().optional(),
  isAvailable: z.boolean().default(true)
});

restaurantRoutes.get("/search", requireAuth, async (req, res, next) => {
  try {
    const filters = z.object({
      q: z.string().optional(),
      cuisine: z.string().optional(),
      diet: z.enum(["all", "veg", "non_veg"]).default("all"),
      minRating: z.coerce.number().min(0).max(5).optional(),
      maxPricePaise: z.coerce.number().int().positive().optional(),
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
      sort: z.enum(["rating_desc", "distance", "price_asc", "price_desc"]).default("rating_desc")
    }).parse(req.query);

    const orderBy = {
      rating_desc: "coalesce(mi.rating, 0) desc, coalesce(r.cuisine_type, mi.cuisine_type, '') asc, mi.price_paise asc",
      distance: "distance_km asc nulls last, coalesce(mi.rating, 0) desc",
      price_asc: "mi.price_paise asc, coalesce(mi.rating, 0) desc",
      price_desc: "mi.price_paise desc, coalesce(mi.rating, 0) desc"
    }[filters.sort];

    const result = await query(
      `select mi.id as menu_item_id,
              mi.name as menu_item_name,
              mi.description,
              mi.price_paise,
              mi.photo_url,
              mi.is_veg,
              coalesce(mi.cuisine_type, r.cuisine_type) as cuisine_type,
              mi.rating,
              r.id as restaurant_id,
              r.name as restaurant_name,
              r.address as restaurant_address,
              r.lat,
              r.lng,
              case
                when $6::numeric is null or $7::numeric is null or r.lat is null or r.lng is null then null
                else (sqrt(power((r.lat - $6::numeric), 2) + power((r.lng - $7::numeric), 2)) * 111)
              end as distance_km
       from menu_items mi
       join restaurants r on r.id = mi.restaurant_id
       where mi.is_available = true
         and r.approval_status = 'approved'
         and ($1::text is null or mi.name ilike '%' || $1 || '%' or r.name ilike '%' || $1 || '%')
         and ($2::text is null or lower(coalesce(mi.cuisine_type, r.cuisine_type, '')) = lower($2))
         and ($3::text = 'all' or ($3::text = 'veg' and mi.is_veg is true) or ($3::text = 'non_veg' and mi.is_veg is false))
         and ($4::numeric is null or coalesce(mi.rating, 0) >= $4::numeric)
         and ($5::integer is null or mi.price_paise <= $5::integer)
       order by ${orderBy}
       limit 100`,
      [
        filters.q || null,
        filters.cuisine || null,
        filters.diet,
        filters.minRating ?? null,
        filters.maxPricePaise ?? null,
        filters.lat ?? null,
        filters.lng ?? null
      ]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/trending", requireAuth, async (req, res, next) => {
  try {
    const filters = z.object({
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(10)
    }).parse(req.query);

    const result = await query(
      `with restaurant_stats as (
         select r.id,
                count(o.id) filter (where o.created_at >= now() - interval '7 days') as recent_orders,
                count(o.id) filter (where o.status = 'delivered' and o.created_at >= now() - interval '30 days') as delivered_orders,
                count(o.id) filter (where o.status in ('created', 'accepted', 'preparing', 'ready', 'picked_up')) as active_orders,
                avg(extract(epoch from (o.updated_at - o.created_at)) / 60)
                  filter (where o.status = 'delivered' and o.created_at >= now() - interval '30 days') as avg_delivery_minutes
         from restaurants r
         left join orders o on o.restaurant_id = r.id
         where r.approval_status = 'approved'
         group by r.id
       ),
       menu_stats as (
         select restaurant_id,
                avg(rating) as avg_menu_rating,
                min(price_paise) as starting_price_paise,
                max(photo_url) filter (where photo_url is not null) as photo_url
         from menu_items
         where is_available = true
         group by restaurant_id
       )
       select r.id,
              r.name,
              r.address,
              r.cuisine_type,
              r.lat,
              r.lng,
              coalesce(rs.recent_orders, 0)::integer as recent_orders,
              coalesce(rs.delivered_orders, 0)::integer as delivered_orders,
              coalesce(rs.active_orders, 0)::integer as active_orders,
              round(coalesce(ms.avg_menu_rating, 0), 2) as rating,
              ms.starting_price_paise,
              ms.photo_url,
              case
                when $1::numeric is null or $2::numeric is null or r.lat is null or r.lng is null then null
                else (sqrt(power((r.lat - $1::numeric), 2) + power((r.lng - $2::numeric), 2)) * 111)
              end as distance_km,
              round(
                (coalesce(rs.recent_orders, 0) * 2.2)
                + (coalesce(ms.avg_menu_rating, 0) * 8)
                + (coalesce(rs.delivered_orders, 0) * 0.35),
                2
              ) as trending_score,
              coalesce(round(rs.avg_delivery_minutes), 0)::integer as historical_eta_minutes
       from restaurants r
       join restaurant_stats rs on rs.id = r.id
       left join menu_stats ms on ms.restaurant_id = r.id
       where r.approval_status = 'approved'
       order by trending_score desc, recent_orders desc, rating desc
       limit $3`,
      [filters.lat ?? null, filters.lng ?? null, filters.limit]
    );

    res.json(result.rows.map(row => ({
      ...row,
      predicted_eta_minutes: etaMinutes(Number(row.distance_km ?? 4), Number(row.active_orders ?? 0))
    })));
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/:restaurantId/menu", requireAuth, async (req, res, next) => {
  try {
    const result = await query("select * from menu_items where restaurant_id = $1 and is_available = true order by created_at desc", [req.params.restaurantId]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.use(requireAuth, requireRole("restaurant", "admin", "super_admin"));

restaurantRoutes.post("/", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      address: z.string().min(5),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      cuisineType: z.string().optional(),
      fssaiLicense: z.string().optional(),
      gstNumber: z.string().optional(),
      bankAccountLast4: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional()
    }).parse(req.body);

    const result = await query(
      `insert into restaurants (
         owner_id, name, address, contact_name, contact_phone, cuisine_type,
         fssai_license, gst_number, bank_account_last4, onboarding_status,
         approval_status, lat, lng
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted', 'pending', $10, $11)
       returning *`,
      [
        req.user!.id,
        body.name,
        body.address,
        body.contactName ?? null,
        body.contactPhone ?? null,
        body.cuisineType ?? null,
        body.fssaiLicense ?? null,
        body.gstNumber ?? null,
        body.bankAccountLast4 ?? null,
        body.lat ?? null,
        body.lng ?? null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.post("/onboarding", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      address: z.string().min(5),
      contactName: z.string().min(2),
      contactPhone: z.string().min(8),
      cuisineType: z.string().min(2),
      fssaiLicense: z.string().optional(),
      gstNumber: z.string().optional(),
      bankAccountLast4: z.string().length(4).optional(),
      lat: z.number().optional(),
      lng: z.number().optional()
    }).parse(req.body);

    const result = await query(
      `insert into restaurants (
         owner_id, name, address, contact_name, contact_phone, cuisine_type,
         fssai_license, gst_number, bank_account_last4, onboarding_status,
         approval_status, lat, lng
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted', 'pending', $10, $11)
       returning *`,
      [
        req.user!.id,
        body.name,
        body.address,
        body.contactName,
        body.contactPhone,
        body.cuisineType,
        body.fssaiLicense ?? null,
        body.gstNumber ?? null,
        body.bankAccountLast4 ?? null,
        body.lat ?? null,
        body.lng ?? null
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      nextStep: "Restaurant submitted for Super Admin approval"
    });
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/google-places/delhi-ncr", requireRole("admin", "super_admin", "restaurant"), async (req, res, next) => {
  try {
    const query = z.object({
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
      radiusMeters: z.coerce.number().optional(),
      minRating: z.coerce.number().default(3),
      limit: z.coerce.number().int().default(20)
    }).parse(req.query);

    res.json({
      source: "google-places",
      region: config.serviceRegionName,
      minRating: query.minRating,
      restaurants: await searchDelhiNcrRestaurants(query)
    });
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/google-places/region", requireRole("admin", "super_admin", "restaurant"), async (req, res, next) => {
  try {
    const query = z.object({
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
      radiusMeters: z.coerce.number().optional(),
      minRating: z.coerce.number().default(3),
      limit: z.coerce.number().int().default(20)
    }).parse(req.query);

    res.json({
      source: "google-places",
      region: config.serviceRegionName,
      minRating: query.minRating,
      restaurants: await searchDelhiNcrRestaurants(query)
    });
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/mine", async (req, res, next) => {
  try {
    const result = await query("select * from restaurants where owner_id = $1 order by created_at desc", [req.user!.id]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.post("/:restaurantId/menu", async (req, res, next) => {
  try {
    const body = menuItemInput.parse(req.body);

    const result = await query(
      `insert into menu_items (
         restaurant_id, name, description, price_paise, photo_url, is_veg,
         cuisine_type, rating, google_place_id, is_available
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        req.params.restaurantId,
        body.name,
        body.description ?? null,
        body.pricePaise,
        body.photoUrl ?? null,
        body.isVeg ?? null,
        body.cuisineType ?? null,
        body.rating ?? null,
        body.googlePlaceId ?? null,
        body.isAvailable
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/:restaurantId/menu", async (req, res, next) => {
  try {
    const result = await query("select * from menu_items where restaurant_id = $1 order by created_at desc", [req.params.restaurantId]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.post("/:restaurantId/menu/import", async (req, res, next) => {
  try {
    const body = z.object({
      items: z.array(menuItemInput).min(1).max(100)
    }).parse(req.body);

    const values: unknown[] = [];
    const placeholders = body.items.map((item, index) => {
      const offset = index * 10;
      values.push(
        req.params.restaurantId,
        item.name,
        item.description ?? null,
        item.pricePaise,
        item.photoUrl ?? null,
        item.isVeg ?? null,
        item.cuisineType ?? null,
        item.rating ?? null,
        item.googlePlaceId ?? null,
        item.isAvailable
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`;
    });

    const result = await query(
      `insert into menu_items (
         restaurant_id, name, description, price_paise, photo_url, is_veg,
         cuisine_type, rating, google_place_id, is_available
       )
       values ${placeholders.join(", ")}
       returning *`,
      values
    );

    res.status(201).json({ imported: result.rowCount, items: result.rows });
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.patch("/menu/:itemId", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      pricePaise: z.number().int().positive().optional(),
      photoUrl: z.string().url().optional(),
      isVeg: z.boolean().optional(),
      cuisineType: z.string().optional(),
      rating: z.number().min(0).max(5).optional(),
      googlePlaceId: z.string().optional(),
      isAvailable: z.boolean().optional()
    }).parse(req.body);

    const result = await query(
      `update menu_items
       set name = coalesce($1, name),
           description = coalesce($2, description),
           price_paise = coalesce($3, price_paise),
           photo_url = coalesce($4, photo_url),
           is_veg = coalesce($5, is_veg),
           cuisine_type = coalesce($6, cuisine_type),
           rating = coalesce($7, rating),
           google_place_id = coalesce($8, google_place_id),
           is_available = coalesce($9, is_available),
           updated_at = now()
       where id = $10
       returning *`,
      [
        body.name ?? null,
        body.description ?? null,
        body.pricePaise ?? null,
        body.photoUrl ?? null,
        body.isVeg ?? null,
        body.cuisineType ?? null,
        body.rating ?? null,
        body.googlePlaceId ?? null,
        body.isAvailable ?? null,
        req.params.itemId
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/:restaurantId/orders", async (req, res, next) => {
  try {
    const result = await query(
      `select * from orders
       where restaurant_id = $1
       order by created_at desc
       limit 100`,
      [req.params.restaurantId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.patch("/orders/:orderId/decision", async (req, res, next) => {
  try {
    const body = z.object({
      decision: z.enum(["accepted", "cancelled"])
    }).parse(req.body);

    const result = await query(
      `update orders
       set status = $1,
           estimated_delivery_at = case
             when $1 = 'accepted' then coalesce(estimated_delivery_at, now() + interval '45 minutes')
             else estimated_delivery_at
           end,
           updated_at = now()
       where id = $2
       returning *`,
      [body.decision, req.params.orderId]
    );
    await query(
      `insert into order_status_history (order_id, status, changed_by, note)
       values ($1, $2::order_status, $3, $4)`,
      [req.params.orderId, body.decision, req.user!.id, `Restaurant ${body.decision} order`]
    );
    emitOrderUpdate(req.params.orderId, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/:restaurantId/earnings", async (req, res, next) => {
  try {
    const result = await query(
      `select count(*) as orders,
              coalesce(sum(total_paise), 0) as gross_paise,
              coalesce(sum(total_paise) * 0.82, 0)::integer as estimated_payout_paise
       from orders
       where restaurant_id = $1
         and status = 'delivered'`,
      [req.params.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
