/** Source discovery and evidence-checked publication. No invented article writer. */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runNewsCli } from './news-pipeline.mjs';
export { discoverNews, publishBatch, validateArticles } from './news-pipeline.mjs';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runNewsCli(process.argv.slice(2)).catch(error => {
    console.error(`[ACTU MMA] ${error.code ?? 'FAILED'}: ${error.message}`);
    process.exitCode = 1;
  });
}
