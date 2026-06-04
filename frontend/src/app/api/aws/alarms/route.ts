import { NextResponse } from 'next/server';
import { CloudWatchClient, DescribeAlarmsCommand } from '@aws-sdk/client-cloudwatch';

const region = process.env.AWS_DEFAULT_REGION || 'ap-south-1';

export async function GET() {
  try {
    const cw = new CloudWatchClient({ region });

    const result = await cw.send(new DescribeAlarmsCommand({
      AlarmNamePrefix: 'finflow',
      MaxRecords: 10,
    }));

    const alarms = (result.MetricAlarms || []).map(alarm => ({
      name: alarm.AlarmName,
      state: alarm.StateValue,
      description: alarm.AlarmDescription,
      metric: alarm.MetricName,
      namespace: alarm.Namespace,
      threshold: alarm.Threshold,
      comparison: alarm.ComparisonOperator,
      period: alarm.Period,
      evaluationPeriods: alarm.EvaluationPeriods,
      stateReason: alarm.StateReason,
      stateUpdated: alarm.StateUpdatedTimestamp?.toISOString(),
    }));

    return NextResponse.json({ alarms });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
