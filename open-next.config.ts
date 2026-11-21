import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/** Cloudflare Workers build (npm run cf:build). Pages are rendered per request; there is no ISR cache. */
export default defineCloudflareConfig({});
