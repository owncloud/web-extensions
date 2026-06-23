import { request } from '@playwright/test'

const TEST_FILES = ['test-document.txt', 'logo.jpeg']

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.BASE_URL_OCIS ?? 'https://host.docker.internal:9200'
  const auth = `Basic ${Buffer.from('admin:admin').toString('base64')}`

  const context = await request.newContext({ baseURL, ignoreHTTPSErrors: true })
  for (const file of TEST_FILES) {
    await context.delete(`/remote.php/dav/files/admin/${file}`, {
      headers: { Authorization: auth }
    })
  }
  await context.dispose()
}
