import {db} from '../database/db.js'; import {err} from '../shared/errors.js';
export function policy(key){const p=db.prepare('SELECT enabled FROM policies WHERE key=?').get(key);return !!p?.enabled;}
export function requirePolicy(key){if(!policy(key))throw err('POLICY_DENIED',`Policy denied: ${key}`,403,{policy:key});}
export function setPolicy(key,enabled){if(!db.prepare('SELECT 1 FROM policies WHERE key=?').get(key))throw err('POLICY_UNKNOWN',`Unknown policy: ${key}`);db.prepare('UPDATE policies SET enabled=?,updated_at=? WHERE key=?').run(enabled?1:0,new Date().toISOString(),key);}
export function allPolicies(){return db.prepare('SELECT key,enabled,updated_at FROM policies ORDER BY key').all().map(x=>({...x,enabled:!!x.enabled}));}
