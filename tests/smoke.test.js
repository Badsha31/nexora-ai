import test from 'node:test';import assert from 'node:assert/strict';import {hashPassword,verifyPassword} from '../shared/security.js';import {agents,canUse} from '../agents/agent-registry.js';
test('password hashing is real',()=>{const h=hashPassword('secret');assert.notEqual(h,'secret');assert.equal(verifyPassword('secret',h),true);assert.equal(verifyPassword('bad',h),false)});
test('agent permissions are explicit',()=>{assert.equal(canUse('coder','terminal'),true);assert.equal(canUse('planner','terminal'),false);assert.ok(agents.deployer);assert.equal(canUse('website_engineer','build'),true);assert.equal(canUse('android_build_engineer','android_build'),true);assert.equal(canUse('cyber_security_engineer','security_scan'),true)});

import {parseAction} from '../agent-engine/index.js';
test('agent parser accepts fenced JSON and normalizes single-file write_files',()=>{const x=parseAction('```json\n{"message":"write","action":{"type":"write_files","path":"index.html","content":"<h1>ok</h1>"}}\n```');assert.equal(x.action.type,'write_file');assert.equal(x.action.path,'index.html');});
test('agent parser rejects prose without JSON action',()=>{assert.throws(()=>parseAction('I will build the project now.'),/MODEL_PROTOCOL/);});
