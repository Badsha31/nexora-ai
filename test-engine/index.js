import {execCommand} from '../tools/terminal.js';import {err} from '../shared/errors.js';
export async function test(project,command='npm test'){const r=await execCommand(project,command,180000);if(r.code!==0)throw err('TESTS_FAILED',r.stderr||'Tests failed',422,{output:r.stdout});return r;}
