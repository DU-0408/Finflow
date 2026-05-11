# ── Package Lambda source into a zip ─────────────────────────────────────────

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src"
  output_path = "${path.module}/lambda_src.zip"
}

# ── Lambda function ───────────────────────────────────────────────────────────

resource "aws_lambda_function" "transaction_processor" {
  function_name = "${var.project_name}-transaction-processor"
  description   = "Processes transactions from Kinesis and archives to S3"

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "python3.11"
  handler          = "handler.lambda_handler"
  role             = aws_iam_role.lambda_exec.arn
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.data_lake.bucket
      SNS_TOPIC_ARN  = aws_sns_topic.alerts.arn
    }
  }

  tags = {
    Name = "${var.project_name}-transaction-processor"
  }
}

# ── Kinesis → Lambda trigger ──────────────────────────────────────────────────

resource "aws_lambda_event_source_mapping" "kinesis_trigger" {
  event_source_arn              = aws_kinesis_stream.transactions.arn
  function_name                 = aws_lambda_function.transaction_processor.arn
  starting_position             = "LATEST"
  batch_size                    = 100
  bisect_batch_on_function_error = true

  depends_on = [aws_iam_role_policy.lambda_policy]
}

# ── CloudWatch log group ──────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.transaction_processor.function_name}"
  retention_in_days = 7
}