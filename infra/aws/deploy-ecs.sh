#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:=us-east-1}"
: "${ECR_REPOSITORY:=amberkitchen-backend}"
: "${ECS_CLUSTER:=amberkitchen}"
: "${ECS_SERVICE:=amberkitchen-backend}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
IMAGE="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"

aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" --region "$AWS_REGION" >/dev/null 2>&1 ||
  aws ecr create-repository --repository-name "$ECR_REPOSITORY" --region "$AWS_REGION" >/dev/null

aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker build -t "$IMAGE" ./backend
docker push "$IMAGE"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --force-new-deployment --region "$AWS_REGION"
