// Collection boundary: never copy free text, exception bodies, paths or identities.
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const services = new Set(['app-api', 'model-api', 'worker-cpu', 'sweeper']);
const levels = new Map([[10,'debug'],[20,'debug'],[30,'info'],[40,'warn'],[50,'error'],[60,'error']]);
export function normalize(record, {service, environment}, now = Date.now()) {
  if (!services.has(service) || !['development','test','production'].includes(environment)) throw new Error('Invalid collection source');
  const raw = record?.level;
  const named = new Map([['info','info'],['warning','warn'],['warn','warn'],['error','error'],['critical','error'],['debug','debug'],['trace','debug']]);
  const level = levels.get(raw) ?? named.get(String(raw).toLowerCase()) ?? 'unknown';
  if (level === 'debug') return null;
  const candidate = record.time ?? record.ts;
  const parsed = typeof candidate === 'number' || typeof candidate === 'string' ? new Date(candidate).getTime() : NaN;
  const out = {timestamp:new Date(Number.isFinite(parsed) ? parsed : now).toISOString(),level,service,environment,event:'service_log'};
  if (typeof record.requestId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(record.requestId)) out.requestId = record.requestId;
  if (Number.isSafeInteger(record.job_id) && record.job_id > 0) out.jobId = record.job_id;
  const errorClass=record.error_class??record.errorClass;
  if (['engine_down','timeout','storage','db','model_not_ready'].includes(errorClass)) out.errorClass=errorClass;
  const stage=record.stage_kind??record.stage;
  if (['split','judge','animate_render','depth_relief','frame_compose','caption','sculpture'].includes(stage)) out.stage=stage;
  const model=record.model_id??record.modelId;
  if (/^M[1-7]$/.test(model??'')) out.modelId=model;
  const duration = record.durationMs ?? record.duration_ms;
  if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) out.durationMs = duration;
  if (Number.isInteger(record.status) && record.status >= 100 && record.status <= 599) out.httpStatus = record.status;
  return out;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = {service:process.argv[2],environment:process.argv[3]};
  for await (const line of createInterface({input:process.stdin})) {
    try { const out = normalize(JSON.parse(line),source); if (out) process.stdout.write(JSON.stringify(out)+'\n'); }
    catch { process.stderr.write('Rejected log record\n'); process.exitCode = 1; }
  }
}
