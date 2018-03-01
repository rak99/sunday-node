import AWS from 'aws-sdk';
import sizeOf from 'image-size';

/** Load Config File */
AWS.config.loadFromPath('src/awsconfig.json');

const s3 = new AWS.S3();
const sundayBucket = 'sundaystories';

export default function uploadAttachment(buffer, key) {
  const params = {
    Bucket: sundayBucket,
    ContentEncoding: 'base64',
    Key: key,
    Body: buffer,
  };
  s3.putObject(params, (err, data) => {
    if (err) {
      console.log(err);
    } else {
      console.log(data);
      console.log('Successfully uploaded data to myBucket/myKey');
    }
  });
}
