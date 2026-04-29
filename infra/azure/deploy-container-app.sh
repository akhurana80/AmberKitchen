#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_RESOURCE_GROUP:=amberkitchen-rg}"
: "${AZURE_LOCATION:=eastus}"
: "${ACR_NAME:=amberkitchenacr}"
: "${CONTAINER_APP_ENV:=amberkitchen-env}"
: "${CONTAINER_APP_NAME:=amberkitchen-backend}"

az group create --name "$AZURE_RESOURCE_GROUP" --location "$AZURE_LOCATION"
az acr create --resource-group "$AZURE_RESOURCE_GROUP" --name "$ACR_NAME" --sku Basic
az acr build --registry "$ACR_NAME" --image amberkitchen-backend:latest ./backend
az containerapp env create --name "$CONTAINER_APP_ENV" --resource-group "$AZURE_RESOURCE_GROUP" --location "$AZURE_LOCATION"
az containerapp up \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --environment "$CONTAINER_APP_ENV" \
  --image "$ACR_NAME.azurecr.io/amberkitchen-backend:latest" \
  --target-port 8080 \
  --ingress external
