import {execCommand} from '../tools/terminal.js';import {err} from '../shared/errors.js';
export async function build(project,command='npm run build'){const r=await execCommand(project,command,180000);if(r.code!==0)throw err('BUILD_FAILED',r.stderr||'Build command failed',422,{output:r.stdout});return r;}
