# ── Lambda error alarm ────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.project_name}-lambda-errors"
  alarm_description   = "Lambda function error rate too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.transaction_processor.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# ── Kinesis iterator age alarm ────────────────────────────────────────────────
# Fires if Lambda falls behind reading from Kinesis

resource "aws_cloudwatch_metric_alarm" "kinesis_iterator_age" {
  alarm_name          = "${var.project_name}-kinesis-iterator-age"
  alarm_description   = "Kinesis consumer falling behind — iterator age too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "GetRecords.IteratorAgeMilliseconds"
  namespace           = "AWS/Kinesis"
  period              = 60
  statistic           = "Maximum"
  threshold           = 60000
  treat_missing_data  = "notBreaching"

  dimensions = {
    StreamName = aws_kinesis_stream.transactions.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# ── Lambda duration alarm ─────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "${var.project_name}-lambda-duration"
  alarm_description   = "Lambda execution time approaching timeout"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Average"
  threshold           = 45000
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.transaction_processor.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}