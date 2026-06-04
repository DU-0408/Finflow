import { NextResponse } from 'next/server';
import { SNSClient, GetTopicAttributesCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const region = process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const topicArn = process.env.SNS_TOPIC_ARN || '';

export async function GET() {
  if (!topicArn) {
    return NextResponse.json({ error: 'SNS_TOPIC_ARN not configured' }, { status: 500 });
  }

  try {
    const sns = new SNSClient({ region });
    const cw = new CloudWatchClient({ region });

    // Topic attributes
    const topic = await sns.send(new GetTopicAttributesCommand({ TopicArn: topicArn }));
    const attrs = topic.Attributes || {};

    // CloudWatch metrics
    const now = new Date();
    const start = new Date(now.getTime() - 3600_000);

    const metrics = await cw.send(new GetMetricDataCommand({
      StartTime: start,
      EndTime: now,
      MetricDataQueries: [
        {
          Id: 'published',
          MetricStat: {
            Metric: { Namespace: 'AWS/SNS', MetricName: 'NumberOfMessagesPublished', Dimensions: [{ Name: 'TopicName', Value: topicArn.split(':').pop() || '' }] },
            Period: 300, Stat: 'Sum',
          },
        },
        {
          Id: 'delivered',
          MetricStat: {
            Metric: { Namespace: 'AWS/SNS', MetricName: 'NumberOfNotificationsDelivered', Dimensions: [{ Name: 'TopicName', Value: topicArn.split(':').pop() || '' }] },
            Period: 300, Stat: 'Sum',
          },
        },
        {
          Id: 'failed',
          MetricStat: {
            Metric: { Namespace: 'AWS/SNS', MetricName: 'NumberOfNotificationsFailed', Dimensions: [{ Name: 'TopicName', Value: topicArn.split(':').pop() || '' }] },
            Period: 300, Stat: 'Sum',
          },
        },
      ],
    }));

    return NextResponse.json({
      topic: {
        name: topicArn.split(':').pop(),
        arn: topicArn,
        subscriptions: parseInt(attrs.SubscriptionsConfirmed || '0'),
        subscriptionsPending: parseInt(attrs.SubscriptionsPending || '0'),
        displayName: attrs.DisplayName || '',
      },
      metrics: {
        published: metrics.MetricDataResults?.[0]?.Values || [],
        delivered: metrics.MetricDataResults?.[1]?.Values || [],
        failed: metrics.MetricDataResults?.[2]?.Values || [],
        timestamps: metrics.MetricDataResults?.[0]?.Timestamps?.map(t => t.toISOString()) || [],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
