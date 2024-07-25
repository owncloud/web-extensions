const config = {
  // environment
  baseUrlOcis: process.env.BASE_URL_OCIS ?? 'https://host.docker.internal:9200',
  adminUser: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  // playwright
  slowMo: parseInt(process.env.SLOW_MO) || 0,
  timeout: parseInt(process.env.TIMEOUT) || 60,
  minTimeout: parseInt(process.env.MIN_TIMEOUT) || 5,
  headless: process.env.HEADLESS === 'true'
}

export default config
