import test from 'ava';
import '../lockdown.js';

lockdown({ errorTaming: 'unsafe' });

test('Compartment prototype', t => {
  t.plan(2);

  t.not(
    Compartment.prototype.constructor,
    Compartment,
    'The initial value of Compartment.prototype.constructor',
  );

  t.deepEqual(
    Reflect.ownKeys(Compartment.prototype).sort(),
    ['constructor', 'evaluate', 'name', 'globalThis', 'toString'].sort(),
    'prototype properties',
  );
});
