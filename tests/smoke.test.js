import test from 'node:test';import assert from 'node:assert/strict';import {hashPassword,verifyPassword} from '../shared/security.js';import {agents,canUse} from '../agents/agent-registry.js';
test('password hashing is real',()=>{const h=hashPassword('secret');assert.notEqual(h,'secret');assert.equal(verifyPassword('secret',h),true);assert.equal(verifyPassword('bad',h),false)});
test('agent permissions are explicit',()=>{assert.equal(canUse('coder','terminal'),true);assert.equal(canUse('planner','terminal'),false);assert.ok(agents.deployer)});
