import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, GetBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const bucketName = process.env.S3_BUCKET_NAME || 'finflow-data-lake';

export async function GET() {
  try {
    const s3 = new S3Client({ region });

    // List recent objects
    const objects = await s3.send(new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 15,
    }));

    // Count totals
    const totalObjects = objects.KeyCount || 0;
    const totalSize = (objects.Contents || []).reduce((sum, obj) => sum + (obj.Size || 0), 0);

    // Get lifecycle rules
    let lifecycle: { id: string; status: string; transitions: string[] }[] = [];
    try {
      const lcConfig = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName }));
      lifecycle = (lcConfig.Rules || []).map(rule => ({
        id: rule.ID || 'unnamed',
        status: rule.Status || 'Unknown',
        transitions: (rule.Transitions || []).map(t =>
          `→ ${t.StorageClass} after ${t.Days} days`
        ),
      }));
    } catch { /* lifecycle may not be configured */ }

    return NextResponse.json({
      bucket: {
        name: bucketName,
        totalObjects,
        totalSize,
        isTruncated: objects.IsTruncated,
      },
      recentFiles: (objects.Contents || []).slice(0, 10).map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified?.toISOString(),
      })),
      lifecycle,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
