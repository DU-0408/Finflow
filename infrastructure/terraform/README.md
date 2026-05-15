# FinFlow Terraform Infrastructure

Provisions AWS infrastructure for the FinFlow pipeline.

## Resources Created

- AWS Kinesis Data Stream (`finflow-transactions`)
- AWS S3 Data Lake with lifecycle policies
- AWS SNS Topic + email subscription for alerts
- AWS Lambda function triggered by Kinesis
- IAM Role + Policy for Lambda execution
- CloudWatch Log Group + 3 metric alarms

## Setup

1. Install Terraform >= 1.5.0
2. Configure AWS CLI: `aws configure`
3. Copy and fill in variables:
```bash
   cp terraform.tfvars.example terraform.tfvars
```
4. Deploy:
```bash
   terraform init
   terraform plan
   terraform apply
```

## Outputs

After apply, copy these values to your `.env`:
- `kinesis_stream_name` → `KINESIS_STREAM_NAME`
- `s3_bucket_name` → `S3_BUCKET_NAME`
- `sns_topic_arn` → `SNS_ALERT_TOPIC_ARN`

## Teardown

To destroy all AWS resources (avoid charges):
```bash
terraform destroy
```