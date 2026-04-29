import os
from typing import BinaryIO
from google.cloud import storage
from fastapi import HTTPException
from app.core.config import settings

def get_gcs_client():
    """Initializes and returns a Google Cloud Storage client."""
    try:
        # If GOOGLE_APPLICATION_CREDENTIALS is set in the environment or config,
        # the storage.Client() will automatically pick it up.
        return storage.Client()
    except Exception as e:
        print(f"Error initializing GCS client: {e}")
        return None

def upload_file_to_gcs(file_obj: BinaryIO, destination_blob_name: str, content_type: str = "video/webm") -> str:
    """Uploads a file to the configured Google Cloud Storage bucket."""
    bucket_name = settings.GCS_BUCKET_NAME
    if not bucket_name:
        raise HTTPException(status_code=500, detail="GCS_BUCKET_NAME is not configured")

    client = get_gcs_client()
    if not client:
        raise HTTPException(status_code=500, detail="Could not initialize GCS client")

    try:
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        
        # Upload the file directly from the file-like object
        blob.upload_from_file(file_obj, content_type=content_type)
        
        # Return the public URL or the gs:// URI based on your requirements
        # Here we return the public URL format
        return f"https://storage.googleapis.com/{bucket_name}/{destination_blob_name}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to GCS: {str(e)}")
