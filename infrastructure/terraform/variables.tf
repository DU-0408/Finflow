variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "finflow"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "alert_email" {
  description = "Email address to receive SNS fraud alerts"
  type        = string
}

variable "kinesis_shard_count" {
  description = "Number of Kinesis shards (1 shard = 1MB/s ingestion)"
  type        = number
  default     = 1
}

variable "s3_retention_days" {
  description = "Days before moving S3 objects to cheaper storage"
  type        = number
  default     = 30
}