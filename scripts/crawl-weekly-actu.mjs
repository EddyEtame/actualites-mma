/** Legacy command now runs the same real, strict 72-hour news discovery. */
import { runNewsCli } from './news-pipeline.mjs';
runNewsCli(process.argv.slice(2)).catch(error => {
  console.error(`[ACTU MMA] ${error.code ?? 'FAILED'}: ${error.message}`);
  process.exitCode = 1;
});
