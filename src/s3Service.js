// s3Service.js
// Service for uploading and listing participant photos in an S3 bucket
// Requires AWS SDK v3 (npm install @aws-sdk/client-s3)

import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const REGION = 'ap-south-1';
const BUCKET = 'band-baja-barat-1';
const ROOT_FOLDER = 'bride/';

// Use direct access key and secret key (NOT recommended for frontend/browser apps)
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: 'AKIAXXHXZN2UZJM2ZJXV', // <-- Replace with your AWS access key
    secretAccessKey: 'SikK9Hew5IblEfN1vn03shT3feQm5Wu5XhQK3u+a', // <-- Replace with your AWS secret key
  },
});

export async function uploadParticipantPhoto(file, participantName) {
  const fileName = participantName.replace(/\s+/g, '_') + '.jpg';
  const params = {
    Bucket: BUCKET,
    Key: ROOT_FOLDER+'incoming-participents/' + fileName,
    Body: file,
    ContentType: file.type || 'image/jpeg',
    // ACL: 'public-read', // Removed because bucket does not allow ACLs
  };
  const command = new PutObjectCommand(params);
  return s3.send(command);
}

export async function listParticipantPhotos() {
  const params = {
    Bucket: BUCKET,
    Prefix: ROOT_FOLDER+'incoming-participents/',
  };
  const command = new ListObjectsV2Command(params);
  const data = await s3.send(command);
  return (data.Contents || []).map(obj => obj.Key);
}

export async function listCompletedParticipantPhotos() {
  const params = {
    Bucket: BUCKET,
    Prefix: ROOT_FOLDER+'completed-participents/',
  };
  const command = new ListObjectsV2Command(params);
  const data = await s3.send(command);
  return (data.Contents || []).map(obj => obj.Key);
}

// Delete an object by key
export async function deleteS3Object(key) {
  const params = {
    Bucket: BUCKET,
    Key: key,
  };
  const command = new DeleteObjectCommand(params);
  return s3.send(command);
}

// Move a file from completed-participents/ back to incoming-participents/
export async function moveCompletedToIncoming(fileName) {
  const sourceKey = `${ROOT_FOLDER}completed-participents/${fileName}`;
  const destKey = `${ROOT_FOLDER}incoming-participents/${fileName}`;
  // Copy the object
  const copyParams = {
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${sourceKey}`,
    Key: destKey,
  };
  await s3.send(new CopyObjectCommand(copyParams));
  // Delete the original object
  const deleteParams = {
    Bucket: BUCKET,
    Key: sourceKey,
  };
  await s3.send(new DeleteObjectCommand(deleteParams));
}
// Download an S3 object as a Blob (for browser use)
export async function downloadS3Object(key) {
  const params = {
    Bucket: BUCKET,
    Key: key,
  };
  const command = new GetObjectCommand(params);
  const data = await s3.send(command);
  // Convert the response body (ReadableStream) to a Blob
  if (data.Body && typeof window !== 'undefined') {
    const stream = data.Body;
    const chunks = [];
    const reader = stream.getReader();
    let done, value;
    while (true) {
      ({ done, value } = await reader.read());
      if (done) break;
      chunks.push(value);
    }
    const blob = new Blob(chunks, { type: data.ContentType || 'image/jpeg' });
    return blob;
  }
  // Fallback: return raw data
  return data.Body;
}

// Move a participant photo from incoming-participents/ to completed-participents/
export async function moveParticipantPhotoToCompleted(fileName) {
  const sourceKey = `${ROOT_FOLDER}incoming-participents/${fileName}`;
  const destKey = `${ROOT_FOLDER}completed-participents/${fileName}`;
  // Copy the object
  const copyParams = {
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${sourceKey}`,
    Key: destKey,
  };
  await s3.send(new CopyObjectCommand(copyParams));
  // Delete the original object
  const deleteParams = {
    Bucket: BUCKET,
    Key: sourceKey,
  };
  await s3.send(new DeleteObjectCommand(deleteParams));
}
