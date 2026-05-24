export interface UploadResult {
  url: string
  path: string
  type: 'image' | 'video'
}

export async function uploadFile(
  file: File,
  bucket: string = 'products',
  folder: string = 'images'
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('bucket', bucket)
  formData.append('folder', folder)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Upload failed')
  }

  return data.data
}

export async function uploadMultipleFiles(
  files: File[],
  bucket: string = 'products',
  folder: string = 'images'
): Promise<UploadResult[]> {
  const results = await Promise.all(files.map((file) => uploadFile(file, bucket, folder)))
  return results
}
