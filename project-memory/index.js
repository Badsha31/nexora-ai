import {db} from '../database/db.js';
export function setMemory(projectId,type,key,value){db.prepare('INSERT INTO memories(project_id,type,key,value,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(project_id,type,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(projectId,type,key,JSON.stringify(value),new Date().toISOString(),new Date().toISOString());}
export function getMemory(projectId){return db.prepare('SELECT type,key,value FROM memories WHERE project_id=? ORDER BY updated_at DESC').all(projectId).map(x=>({...x,value:JSON.parse(x.value)}));}
