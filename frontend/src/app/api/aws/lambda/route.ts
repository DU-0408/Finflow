import { NextResponse } from 'next/server';
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const region = process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const funcName = process.env.LAMBDA_FUNCTION_NAME || 'finflow-transaction-processor';

export async function GET() {
  try {
    const lambda = new LambdaClient({ region });
    const cw = new CloudWatchClient({ region });
    const cwLogs = new CloudWatchLogsClient({ region });

    // Get function config
    const func = await lambda.send(new GetFunctionCommand({ FunctionName: funcName }));
    const config = func.Configuration;

    // CloudWatch metrics for last hour
    const now = new Date();
    const start = new Date(now.getTime() - 3600_000);

    const metrics = await cw.send(new GetMetricDataCommand({
      StartTime: start,
      EndTime: now,
      MetricDataQueries: [
        {
          Id: 'invocations',
          MetricStat: {
            Metric: { Namespace: 'AWS/Lambda', MetricName: 'Invocations', Dimensions: [{ Name: 'FunctionName', Value: funcName }] },
            Period: 300, Stat: 'Sum',
          },
        },
        {
          Id: 'errors',
          MetricStat: {
            Metric: { Namespace: 'AWS/Lambda', MetricName: 'Errors', Dimensions: [{ Name: 'FunctionName', Value: funcName }] },
            Period: 300, Stat: 'Sum',
          },
        },
        {
          Id: 'duration',
          MetricStat: {
            Metric: { Namespace: 'AWS/Lambda', MetricName: 'Duration', Dimensions: [{ Name: 'FunctionName', Value: funcName }] },
            Period: 300, Stat: 'Average',
          },
        },
      ],
    }));

    // Recent logs
    let recentLogs: { timestamp: string; message: string }[] = [];
    try {
      const logGroup = `/aws/lambda/${funcName}`;
      const streams = await cwLogs.send(new DescribeLogStreamsCommand({
        logGroupName: logGroup,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 1,
      }));

      if (streams.logStreams?.[0]?.logStreamName) {
        const events = await cwLogs.send(new GetLogEventsCommand({
          logGroupName: logGroup,
          logStreamName: streams.logStreams[0].logStreamName,
          limit: 20,
          startFromHead: false,
        }));
        recentLogs = (events.events || []).map(e => ({
          timestamp: new Date(e.timestamp || 0).toISOString(),
          message: e.message?.trim() || '',
        }));
      }
    } catch { /* logs may not exist */ }

    return NextResponse.json({
      function: {
        name: config?.FunctionName,
        runtime: config?.Runtime,
        memory: config?.MemorySize,
        timeout: config?.Timeout,
        handler: config?.Handler,
        codeSize: config?.CodeSize,
        lastModified: config?.LastModified,
        state: config?.State,
      },
      metrics: {
        invocations: metrics.MetricDataResults?.[0]?.Values || [],
        errors: metrics.MetricDataResults?.[1]?.Values || [],
        duration: metrics.MetricDataResults?.[2]?.Values || [],
        timestamps: metrics.MetricDataResults?.[0]?.Timestamps?.map(t => t.toISOString()) || [],
      },
      recentLogs,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
