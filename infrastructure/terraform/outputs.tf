output "kinesis_stream_name" {
  description = "Kinesis stream name — add to .env as KINESIS_STREAM_NAME"
  value       = aws_kinesis_stream.transactions.name
}

output "kinesis_stream_arn" {
  description = "Kinesis stream ARN"
  value       = aws_kinesis_stream.transactions.arn
}

output "s3_bucket_name" {
  description = "S3 data lake bucket name — add to .env as S3_BUCKET_NAME"
  value       = aws_s3_bucket.data_lake.bucket
}

output "sns_topic_arn" {
  description = "SNS alerts topic ARN — add to .env as SNS_ALERT_TOPIC_ARN"
  value       = aws_sns_topic.alerts.arn
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.transaction_processor.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.transaction_processor.arn
}

output "cloudwatch_log_group" {
  description = "Lambda CloudWatch log group"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}