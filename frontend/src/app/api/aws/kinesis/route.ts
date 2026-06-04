import { NextResponse } from 'next/server';
import { KinesisClient, DescribeStreamSummaryCommand } from '@aws-sdk/client-kinesis';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const region = process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const streamName = process.env.KINESIS_STREAM_NAME || 'finflow-transactions';

export async function GET() {
  try {
    const kinesis = new KinesisClient({ region });
    const cw = new CloudWatchClient({ region });

    const stream = await kinesis.send(new DescribeStreamSummaryCommand({ StreamName: streamName }));
    const summary = stream.StreamDescriptionSummary;

    // Get throughput metrics for last hour
    const now = new Date();
    const start = new Date(now.getTime() - 3600_000);

    const metrics = await cw.send(new GetMetricDataCommand({
      StartTime: start,
      EndTime: now,
      MetricDataQueries: [
        {
          Id: 'incomingRecords',
          MetricStat: {
            Metric: { Namespace: 'AWS/Kinesis', MetricName: 'IncomingRecords', Dimensions: [{ Name: 'StreamName', Value: streamName }] },
            Period: 300, Stat: 'Sum',
          },
        },
        {
          Id: 'incomingBytes',
          MetricStat: {
            Metric: { Namespace: 'AWS/Kinesis', MetricName: 'IncomingBytes', Dimensions: [{ Name: 'StreamName', Value: streamName }] },
            Period: 300, Stat: 'Sum',
          },
        },
      ],
    }));

    return NextResponse.json({
      stream: {
        name: summary?.StreamName,
        status: summary?.StreamStatus,
        shards: summary?.OpenShardCount,
        retention: summary?.RetentionPeriodHours,
        arn: summary?.StreamARN,
        createdAt: summary?.StreamCreationTimestamp?.toISOString(),
      },
      metrics: {
        incomingRecords: metrics.MetricDataResults?.[0]?.Values || [],
        incomingBytes: metrics.MetricDataResults?.[1]?.Values || [],
        timestamps: metrics.MetricDataResults?.[0]?.Timestamps?.map(t => t.toISOString()) || [],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
