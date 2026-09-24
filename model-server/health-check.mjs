import {health} from './adapter.js';

const result=await health();
console.log(JSON.stringify(result,null,2));
if(!result.available)process.exit(1);
