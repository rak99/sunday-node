import AWS from 'aws-sdk';

/** Load Config File */
AWS.config.loadFromPath('../../awsconfig.json');

const s3 = new AWS.S3();
const sundayBucket = 'sundaystories';

export async function uploadAttachment(buffer, key) {
  try {
    const params = {
      Bucket: sundayBucket,
      ContentEncoding: 'base64',
      Key: key,
      Body: buffer,
    };
    const upload = await s3.putObject(params).promise();
    console.log(`^^^^^^^^ Upload ${key}, ETag: ${upload.ETag} ^^^^^^^^`);
  } catch (e) {
    console.log(e);
  }
}

export async function deleteFile(key) {
  try {
    const params = {
      Bucket: sundayBucket,
      Delete: {
        Objects: [
          {
            Key: key,
          },
        ],
      },
    };
    const deleteObject = await s3.deleteObjects(params).promise();
    console.log(`^^^^^^^^ Delete ${key} (${deleteObject.Deleted.length}) ^^^^^^^^`);
  } catch (e) {
    console.log(e);
  }
}
