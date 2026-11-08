'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const v8 = require('node:v8');

function sample() {
  return {
    version: 23, regionOf: Uint16Array.from([1, 2, 3]), events: [{ text: '世界历史', year: 100 }],
    military: {
      version: 1,
      campaigns: Array.from({ length: 250 }, (_, id) => ({ id, timeline: Array.from({ length: 12 }, (_, time) => ({ time, phase: `阶段${id}-${time}`, note: 'x'.repeat(100) })) })),
      effects: Array.from({ length: 70 }, (_, id) => ({ id, count: id * 2 })),
      armies: Array.from({ length: 70 }, (_, p) => ({ p, history: [[p, p * 10]] }))
    }
  };
}

function harness(history, options = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../site/core/worker.js'), 'utf8');
  const marker = '  let world = null, R = null;';
  assert.ok(source.includes(marker));
  const messages = [];
  let chunkCount = 0;
  const context = { __history: history, importScripts() {}, setTimeout, clearTimeout };
  context.self = context;
  context.postMessage = message => {
    if (message.type === 'historyChunk' && options.failChunk && ++chunkCount === options.failChunk) {
      options.failChunk = 0;
      throw new Error('simulated chunk failure');
    }
    if (v8.serialize(message).byteLength > 120000) throw new Error('simulated single-message limit');
    messages.push(structuredClone(message));
  };
  vm.runInNewContext(source.replace(marker, '  let world = { history: __history }, R = null;'), context, { filename: 'worker.js' });
  return {
    send: message => context.onmessage({ data: message }),
    take: () => messages.shift(),
    count: () => messages.length
  };
}

function receive(worker, id) {
  let result;
  for (let n = 0; n < 10000; n++) {
    const msg = worker.take();
    assert.ok(msg, 'worker must send a response');
    assert.equal(msg.id, id);
    if (msg.type === 'error') return { error: msg };
    if (msg.type === 'historyStart') result = msg.data;
    else if (msg.type === 'historyChunk') result.military[msg.key].push(...msg.data);
    else if (msg.type === 'history') { assert.equal(msg.done, true); return { data: result }; }
    else assert.fail(`unexpected response ${msg.type}`);
    worker.send({ type: 'historyNext', id });
  }
  assert.fail('history stream did not finish');
}

test('large history is reconstructed exactly, remains cached, and can be requested again', () => {
  const original = sample(), snapshot = structuredClone(original), worker = harness(original);
  assert.ok(v8.serialize({ type: 'history', id: 1, data: original }).byteLength > 120000);
  for (const id of [1, 2]) {
    worker.send({ type: 'history', id });
    assert.deepEqual(receive(worker, id).data, snapshot);
    assert.deepEqual(original, snapshot);
  }
});

test('empty military lists and cancelled requests do not block subsequent requests', () => {
  const empty = sample();
  for (const key of ['campaigns', 'effects', 'armies']) empty.military[key] = [];
  const worker = harness(empty);
  worker.send({ type: 'history', id: 1 });
  assert.equal(worker.take().type, 'historyStart');
  worker.send({ type: 'historyCancel', id: 1 });
  worker.send({ type: 'historyNext', id: 1 });
  assert.equal(worker.count(), 0);
  worker.send({ type: 'history', id: 2 });
  assert.deepEqual(receive(worker, 2).data, empty);
});

test('failed batch reports the request error, preserves history and allows retry', () => {
  const original = sample(), snapshot = structuredClone(original), worker = harness(original, { failChunk: 2 });
  worker.send({ type: 'history', id: 1 });
  const { error } = receive(worker, 1);
  assert.equal(error.requestType, 'history');
  assert.match(error.message, /simulated chunk failure/);
  assert.deepEqual(original, snapshot);
  worker.send({ type: 'history', id: 2 });
  assert.deepEqual(receive(worker, 2).data, snapshot);
});
