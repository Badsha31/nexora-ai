import crypto from 'node:crypto';import {db} from '../database/db.js';import {encrypt} from '../shared/security.js';import {err} from '../shared/errors.js';
function key(){if(!process.env.NEXORA_VAULT_KEY)throw err('VAULT_KEY_MISSING','NEXORA_VAULT_KEY is not configured',503);return process.env.NEXORA_VAULT_KEY;}
export function put(name,value){const e=encrypt(value,key());db.prepare('INSERT INTO credentials VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET ciphertext=excluded.ciphertext,iv=excluded.iv,tag=excluded.tag').run(crypto.randomUUID(),name,e.ciphertext,e.iv,e.tag,new Date().toISOString());return {name,stored:true};}
export function list(){return db.prepare('SELECT id,name,created_at FROM credentials').all();}
