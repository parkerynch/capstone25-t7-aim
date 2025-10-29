#!/bin/bash

# AWS CLI가 LocalStack을 바라보도록 설정
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=ap-northeast-2

echo "--- 🚀 S3 초기화 스크립트 (버킷 생성 전용) 🚀 ---"

# 1. 'aim-deploy-bucket' 버킷 생성 (이미 존재하면 무시)
awslocal s3api create-bucket \
    --bucket aim-deploy-bucket \
    --region ap-northeast-2 \
    --create-bucket-configuration LocationConstraint=ap-northeast-2 \
    || echo "Bucket 'aim-deploy-bucket' already exists."

echo "✅ S3 'aim-deploy-bucket' 버킷 준비 완료."
echo "--- 🚀 S3 초기화 스크립트 종료 🚀 ---"