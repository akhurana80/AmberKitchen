import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";
import { createAzureBlobAsset, verifyDocumentWithAzureOcr, verifyFaceWithAzure } from "../services/azure.service";

export const integrationRoutes = Router();

integrationRoutes.use(requireAuth);

integrationRoutes.post("/azure/blob/assets", async (req, res, next) => {
  try {
    const body = z.object({
      fileName: z.string().min(1),
      contentType: z.string().min(3),
      sizeBytes: z.number().int().positive(),
      metadata: z.record(z.unknown()).optional(),
      data: z.string().optional()
    }).parse(req.body);
    res.status(201).json(await createAzureBlobAsset({ ownerId: req.user!.id, ...body }));
  } catch (error) {
    next(error);
  }
});

integrationRoutes.post("/azure/ocr/verify", requireRole("driver", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({ imageUrl: z.string().min(10) }).parse(req.body);
    res.status(201).json(await verifyDocumentWithAzureOcr(req.user!.id, body.imageUrl));
  } catch (error) {
    next(error);
  }
});

integrationRoutes.post("/azure/face/verify", requireRole("driver", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      selfieUrl: z.string().min(10),
      documentUrl: z.string().min(10)
    }).parse(req.body);
    res.status(201).json(await verifyFaceWithAzure(req.user!.id, body.selfieUrl, body.documentUrl));
  } catch (error) {
    next(error);
  }
});

integrationRoutes.get("/audit-logs", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query("select * from audit_logs order by created_at desc limit 200");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

integrationRoutes.get("/verification-checks", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query("select * from verification_checks order by created_at desc limit 200");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
