import {requirePolicy} from '../admin/policy.js';import {err} from '../shared/errors.js';
export async function deploy(){requirePolicy('deployment');throw err('DEPLOYMENT_NOT_CONFIGURED','No external deployment provider is configured. Add an authorized provider before deployment.',412);}
