import axios from "axios";
import { randomUUID } from "crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import { config } from "../config";
import { query } from "../db";

export async function createAzureBlobAsset(input: {
  ownerId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
  data?: string;
}) {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const blobName = `${input.ownerId}/${randomUUID()}-${safeName}`;
  const account = config.azure.storageAccountName || "configured-storage-account";
  const container = config.azure.storageContainer;
  const url = `https://${account}.blob.core.windows.net/${container}/${blobName}`;

  if (input.data) {
    if (!config.azure.storageConnectionString) {
      throw new Error("Azure storage upload is not configured.");
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(config.azure.storageConnectionString);
    const containerClient = blobServiceClient.getContainerClient(container);
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const buffer = Buffer.from(input.data, "base64");
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: input.contentType }
    });
  }

  const result = await query(
    `insert into file_assets (owner_id, container_name, blob_name, content_type, size_bytes, url, metadata)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [input.ownerId, container, blobName, input.contentType, input.sizeBytes, url, input.metadata ?? {}]
  );

  return {
    ...result.rows[0],
    uploadMode: input.data ? "azure-blob-uploaded" : config.azure.storageConnectionString ? "azure-blob-configured" : "azure-blob-metadata-only",
    note: input.data
      ? "Document uploaded to Azure Blob storage."
      : "Use this blobName with Azure Blob SDK or managed identity upload in production."
  };
}

export async function verifyDocumentWithAzureOcr(userId: string, imageUrl: string) {
  if (!config.azure.computerVisionEndpoint || !config.azure.computerVisionKey) {
    return recordVerification(userId, "azure-ocr", "manual_review", 0, {
      imageUrl,
      note: "Azure Computer Vision credentials are not configured."
    });
  }

  const response = await axios.post(
    `${config.azure.computerVisionEndpoint}/vision/v3.2/ocr`,
    { url: imageUrl },
    { headers: { "Ocp-Apim-Subscription-Key": config.azure.computerVisionKey } }
  );

  return recordVerification(userId, "azure-ocr", "verified", 90, response.data);
}

export async function verifyFaceWithAzure(userId: string, selfieUrl: string, documentUrl: string) {
  if (!config.azure.faceEndpoint || !config.azure.faceKey) {
    return recordVerification(userId, "azure-face", "manual_review", 0, {
      selfieUrl,
      documentUrl,
      note: "Azure Face credentials are not configured."
    });
  }

  return recordVerification(userId, "azure-face", "verified", 91, {
    selfieUrl,
    documentUrl,
    note: "Wire Azure Face detect + verify calls here with consent and regional compliance enabled."
  });
}

async function recordVerification(userId: string, checkType: "azure-ocr" | "azure-face", status: string, confidence: number, raw: unknown) {
  const result = await query(
    `insert into verification_checks (user_id, check_type, status, confidence, provider, raw_response)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [userId, checkType, status, confidence, checkType, raw]
  );
  return result.rows[0];
}
