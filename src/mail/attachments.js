import AWS from 'aws-sdk';
import sizeOf from 'image-size';

/** Load Config File */
AWS.config.loadFromPath('src/awsconfig.json');

const s3 = new AWS.S3();
const sundayBucket = 'sundaystories';

export default async function uploadAttachment(buffer, key) {
  try {
    const params = {
      Bucket: sundayBucket,
      ContentEncoding: 'base64',
      Key: key,
      Body: buffer,
    };
    const upload = await s3.putObject(params).promise();
    console.log(`Successfully uploaded ${key}`);
    console.log(upload);
  } catch (e) {
    console.log(e);
  }
}