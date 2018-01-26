/*
 * Copyright (C) 2018 Alasdair Mercer, !ninja
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

const assert = require('assert');
const { EOL } = require('os');
const sinon = require('sinon');

const { MockReadable, MockWritable } = require('./mock-stream');
const PropertiesStore = require('../src/properties-store');

describe('PropertiesStore', () => {
  describe('.load', () => {
    it('should create PropertiesStore loaded with properties read from input', async() => {
      const input = new MockReadable(Buffer.from([
        '',
        '# foo',
        'foo=bar'
      ].join('\n')));
      const expected = [
        [ 'foo', 'bar' ]
      ];

      const store = await PropertiesStore.load(input);

      assert.deepEqual(Array.from(store), expected);
    });

    context('when encoding option is not specified', () => {
      it('should read input using latin1 encoding', async() => {
        const input = new MockReadable(Buffer.from('foo¥bar=fu¥baz'));
        const expected = [
          [ Buffer.from('foo¥bar').toString('latin1'), Buffer.from('fu¥baz').toString('latin1') ]
        ];

        const store = await PropertiesStore.load(input);

        assert.deepEqual(Array.from(store), expected);
      });
    });

    context('when encoding option is specified', () => {
      it('should read input using encoding', async() => {
        const input = new MockReadable(Buffer.from('foo¥bar=fu¥baz'));
        const expected = [
          [ 'foo¥bar', 'fu¥baz' ]
        ];

        const store = await PropertiesStore.load(input, { encoding: 'utf8' });

        assert.deepEqual(Array.from(store), expected);
      });
    });
  });

  it('should contain no properties initially', () => {
    const expected = [];
    const store = new PropertiesStore();

    assert.deepEqual(Array.from(store), expected);
  });

  context('when store is specified', () => {
    it('should contain properties from store initially', () => {
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ]
      ];
      const other = new PropertiesStore();

      for (const [ key, value ] of properties) {
        other.set(key, value);
      }

      const store = new PropertiesStore(other);

      assert.deepEqual(Array.from(store), properties);
    });

    it('should not reflect any changes to store afterwards', () => {
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ]
      ];
      const other = new PropertiesStore();

      for (const [ key, value ] of properties) {
        other.set(key, value);
      }

      const store = new PropertiesStore(other);

      other.clear();

      assert.deepEqual(Array.from(store), properties);
    });
  });

  describe('#clear', () => {
    it('should remove all properties', () => {
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      store.clear();

      assert.equal(store.size, 0);
    });

    it('should emit single "clear" event and a "delete" event for each removed property', () => {
      const clearCallback = sinon.spy();
      const deleteCallback = sinon.spy();
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      store.on('clear', clearCallback);
      store.on('delete', deleteCallback);

      store.clear();

      assert.equal(clearCallback.callCount, 1);
      assert.equal(deleteCallback.callCount, 3);

      const clearCalls = clearCallback.getCalls();

      assert.deepEqual(clearCalls[0].args, [
        { properties: store }
      ]);

      const deleteCalls = deleteCallback.getCalls();

      assert.deepEqual(deleteCalls[0].args, [
        {
          key: 'foo',
          properties: store,
          value: 'bar'
        }
      ]);
      assert.deepEqual(deleteCalls[1].args, [
        {
          key: 'fu',
          properties: store,
          value: 'baz'
        }
      ]);
      assert.deepEqual(deleteCalls[2].args, [
        {
          key: 'fizz',
          properties: store,
          value: 'buzz'
        }
      ]);
    });

    context('when no properties exist', () => {
      it('should emit "clear" event but not "delete" event', () => {
        const clearCallback = sinon.spy();
        const deleteCallback = sinon.spy();
        const store = new PropertiesStore();

        store.on('clear', clearCallback);
        store.on('delete', deleteCallback);

        store.clear();

        assert.equal(clearCallback.callCount, 1);
        assert.equal(deleteCallback.callCount, 0);

        const clearCalls = clearCallback.getCalls();

        assert.deepEqual(clearCalls[0].args, [
          { properties: store }
        ]);
      });
    });
  });

  describe('#delete', () => {
    it('should remove property for key and return true', () => {
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const expected = properties.slice(1);
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      assert.equal(store.delete('foo'), true);

      assert.deepEqual(Array.from(store), expected);
    });

    it('should emit "delete" event', () => {
      const deleteCallback = sinon.spy();
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      store.on('delete', deleteCallback);

      assert.equal(store.delete('foo'), true);

      assert.equal(deleteCallback.callCount, 1);

      const deleteCalls = deleteCallback.getCalls();

      assert.deepEqual(deleteCalls[0].args, [
        {
          key: 'foo',
          properties: store,
          value: 'bar'
        }
      ]);
    });

    context('when no property exists for key', () => {
      it('should not remove any property and return false', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.equal(store.delete('fizz'), false);

        assert.deepEqual(Array.from(store), properties);
      });

      it('should not emit "delete" event', () => {
        const deleteCallback = sinon.spy();
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        store.on('delete', deleteCallback);

        assert.equal(store.delete('fizz'), false);

        assert.equal(deleteCallback.callCount, 0);
      });
    });

    context('when key is using different case', () => {
      it('should not remove any property and return false', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'FU', 'baz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.equal(store.delete('FOO'), false);
        assert.equal(store.delete('fu'), false);

        assert.deepEqual(Array.from(store), properties);
      });

      it('should not emit "delete" event', () => {
        const deleteCallback = sinon.spy();
        const properties = [
          [ 'foo', 'bar' ],
          [ 'FU', 'baz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        store.on('delete', deleteCallback);

        assert.equal(store.delete('FOO'), false);
        assert.equal(store.delete('fu'), false);

        assert.equal(deleteCallback.callCount, 0);
      });
    });

    context('when key is null', () => {
      it('should not remove any property and return false', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.equal(store.delete(null), false);

        assert.deepEqual(Array.from(store), properties);
      });

      it('should not emit "delete" event', () => {
        const deleteCallback = sinon.spy();
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        store.on('delete', deleteCallback);

        assert.equal(store.delete(null), false);

        assert.equal(deleteCallback.callCount, 0);
      });
    });
  });

  describe('#entries', () => {
    it('should return iterator for each property key/value pair', () => {
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      const iterator = store.entries();

      assert.deepEqual(iterator.next().value, [ 'foo', 'bar' ]);
      assert.deepEqual(iterator.next().value, [ 'fu', 'baz' ]);
      assert.deepEqual(iterator.next().value, [ 'fizz', 'buzz' ]);
      assert.strictEqual(iterator.next().value, undefined);

      assert.deepEqual(Array.from(store.entries()), properties);
    });

    context('when no properties exist', () => {
      it('should return an empty iterator', () => {
        const store = new PropertiesStore();
        const iterator = store.entries();

        assert.strictEqual(iterator.next().value, undefined);

        assert.deepEqual(Array.from(store.entries()), []);
      });
    });
  });

  describe('#forEach', () => {
    it('should invoke callback with each property key/value pair', () => {
      const callback = sinon.stub();
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      store.forEach(callback);

      assert.equal(callback.callCount, 3);

      const calls = callback.getCalls();

      assert.deepEqual(calls[0].args, [ 'bar', 'foo', store ]);
      assert.strictEqual(calls[0].thisValue, undefined);

      assert.deepEqual(calls[1].args, [ 'baz', 'fu', store ]);
      assert.strictEqual(calls[1].thisValue, undefined);

      assert.deepEqual(calls[2].args, [ 'buzz', 'fizz', store ]);
      assert.strictEqual(calls[2].thisValue, undefined);
    });

    context('when no properties exist', () => {
      it('should not invoke callback', () => {
        const callback = sinon.stub();
        const store = new PropertiesStore();

        store.forEach(callback);

        assert.equal(callback.callCount, 0);
      });
    });

    context('when thisArg is specified', () => {
      it('should invoke callback using thisArg as "this"', () => {
        const callback = sinon.stub();
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();
        const thisArg = {};

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        store.forEach(callback, thisArg);

        assert.equal(callback.callCount, 3);

        const calls = callback.getCalls();

        assert.deepEqual(calls[0].args, [ 'bar', 'foo', store ]);
        assert.strictEqual(calls[0].thisValue, thisArg);

        assert.deepEqual(calls[1].args, [ 'baz', 'fu', store ]);
        assert.strictEqual(calls[1].thisValue, thisArg);

        assert.deepEqual(calls[2].args, [ 'buzz', 'fizz', store ]);
        assert.strictEqual(calls[2].thisValue, thisArg);
      });
    });
  });

  describe('#get', () => {
    context('when property exists for key', () => {
      it('should return value of property for key', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.strictEqual(store.get('foo'), 'bar');
        assert.strictEqual(store.get('fu'), 'baz');
        assert.strictEqual(store.get('fizz'), 'buzz');
      });
    });

    context('when no property exists for key', () => {
      context('and defaultValue is specified', () => {
        it('should return string representation of defaultValue', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'fu', 'baz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get('fizz', '123'), '123');
          assert.strictEqual(store.get('fizz', 123), '123');
          assert.strictEqual(store.get('fizz', false), 'false');
        });
      });

      context('and defaultValue is null', () => {
        it('should return null', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'fu', 'baz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get('fizz', null), null);
        });
      });

      context('and defaultValue is omitted', () => {
        it('should return undefined', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'fu', 'baz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get('fizz'), undefined);
        });
      });
    });

    context('when key is using different case', () => {
      context('and defaultValue is specified', () => {
        it('should return string representation of defaultValue', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'FU', 'baz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get('FOO', '123'), '123');
          assert.strictEqual(store.get('fu', 123), '123');
          assert.strictEqual(store.get('FOO', false), 'false');
        });
      });

      context('and defaultValue is null', () => {
        it('should return null', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'FU', 'baz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get('FOO', null), null);
          assert.strictEqual(store.get('fu', null), null);
        });
      });

      context('and defaultValue is omitted', () => {
        it('should return undefined', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'FU', 'baz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get('FOO'), undefined);
          assert.strictEqual(store.get('fu'), undefined);
        });
      });
    });

    context('when key is null', () => {
      context('and defaultValue is specified', () => {
        it('should return string representation of defaultValue', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'fu', 'baz' ],
            [ 'fizz', 'buzz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get(null, '123'), '123');
          assert.strictEqual(store.get(null, 123), '123');
          assert.strictEqual(store.get(null, false), 'false');
        });
      });

      context('and defaultValue is null', () => {
        it('should return null', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'FU', 'baz' ],
            [ 'fizz', 'buzz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get(null, null), null);
          assert.strictEqual(store.get(null, null), null);
        });
      });

      context('and defaultValue is omitted', () => {
        it('should return undefined', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'FU', 'baz' ],
            [ 'fizz', 'buzz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.get(null), undefined);
          assert.strictEqual(store.get(null), undefined);
        });
      });
    });
  });

  describe('#has', () => {
    context('when a property exists for key', () => {
      it('should return true', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.equal(store.has('foo'), true);
      });
    });

    context('when no property exist for key', () => {
      it('should return false', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.equal(store.has('fizz'), false);
      });
    });

    context('when key is using different case', () => {
      it('should return false', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'FU', 'baz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.equal(store.has('FOO'), false);
        assert.equal(store.has('fu'), false);
      });
    });

    context('when key is null', () => {
      it('should return false', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.equal(store.has(null), false);
      });
    });
  });

  describe('#keys', () => {
    it('should return iterator for each property key', () => {
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const expected = properties.map(([ key ]) => key);
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      const iterator = store.keys();

      assert.equal(iterator.next().value, 'foo');
      assert.equal(iterator.next().value, 'fu');
      assert.equal(iterator.next().value, 'fizz');
      assert.strictEqual(iterator.next().value, undefined);

      assert.deepEqual(Array.from(store.keys()), expected);
    });

    context('when no properties exist', () => {
      it('should return an empty iterator', () => {
        const store = new PropertiesStore();
        const iterator = store.keys();

        assert.strictEqual(iterator.next().value, undefined);

        assert.deepEqual(Array.from(store.keys()), []);
      });
    });
  });

  describe('#load', () => {
    it('should read properties from input', async() => {
      const input = new MockReadable(Buffer.from([
        '',
        '# foo',
        'foo=bar'
      ].join('\n')));
      const expected = [
        [ 'foo', 'bar' ]
      ];
      const store = new PropertiesStore();

      await store.load(input);

      assert.deepEqual(Array.from(store), expected);
    });

    it('should emit "load" event and a "change" event for each changed property', async() => {
      const changeCallback = sinon.spy();
      const loadCallback = sinon.spy();
      const input = new MockReadable(Buffer.from([
        '',
        '# foo',
        'foo=bar',
        '',
        'foo=baz',
        'foo=buzz',
        '',
        'fu=bar'
      ].join('\n')));
      const store = new PropertiesStore();

      store.on('change', changeCallback);
      store.on('load', loadCallback);

      await store.load(input);

      assert.equal(changeCallback.callCount, 4);
      assert.equal(loadCallback.callCount, 1);

      const changeCalls = changeCallback.getCalls();

      assert.deepEqual(changeCalls[0].args, [
        {
          key: 'foo',
          newValue: 'bar',
          oldValue: undefined,
          properties: store
        }
      ]);
      assert.deepEqual(changeCalls[1].args, [
        {
          key: 'foo',
          newValue: 'baz',
          oldValue: 'bar',
          properties: store
        }
      ]);
      assert.deepEqual(changeCalls[2].args, [
        {
          key: 'foo',
          newValue: 'buzz',
          oldValue: 'baz',
          properties: store
        }
      ]);
      assert.deepEqual(changeCalls[3].args, [
        {
          key: 'fu',
          newValue: 'bar',
          oldValue: undefined,
          properties: store
        }
      ]);

      const loadCalls = loadCallback.getCalls();

      assert.deepEqual(loadCalls[0].args, [
        {
          input,
          options: { encoding: 'latin1' },
          properties: store
        }
      ]);
    });

    it('should extend existing properties', async() => {
      const input = new MockReadable(Buffer.from([
        '',
        '# foo',
        'foo=buzz',
        '',
        'fu=baz'
      ].join('\n')));
      const expected = [
        [ 'foo', 'buzz' ],
        [ 'fu', 'baz' ]
      ];
      const store = new PropertiesStore();
      store.set('foo', 'bar');

      await store.load(input);

      assert.deepEqual(Array.from(store), expected);
    });

    context('when input contains no property lines', () => {
      it('should read no properties', async() => {
        const input = new MockReadable(Buffer.from([
          '',
          '# foo'
        ].join('\n')));
        const store = new PropertiesStore();

        await store.load(input);

        assert.equal(store.size, 0);
      });

      it('should emit "load" event but not any "change" events', async() => {
        const changeCallback = sinon.spy();
        const loadCallback = sinon.spy();
        const input = new MockReadable(Buffer.from([
          '',
          '# foo'
        ].join('\n')));
        const store = new PropertiesStore();

        store.on('change', changeCallback);
        store.on('load', loadCallback);

        await store.load(input);

        assert.equal(changeCallback.callCount, 0);
        assert.equal(loadCallback.callCount, 1);

        const loadCalls = loadCallback.getCalls();

        assert.deepEqual(loadCalls[0].args, [
          {
            input,
            options: { encoding: 'latin1' },
            properties: store
          }
        ]);
      });
    });

    context('when input is empty', () => {
      it('should read no properties', async() => {
        const input = new MockReadable();
        const store = new PropertiesStore();

        await store.load(input);

        assert.equal(store.size, 0);
      });
    });

    context('when input is TTY', () => {
      it('should read no properties', async() => {
        const input = new MockReadable(Buffer.from([
          '',
          '# foo',
          'foo=bar'
        ].join('\n')));
        input.isTTY = true;
        const store = new PropertiesStore();

        await store.load(input);

        assert.equal(store.size, 0);
      });
    });

    context('when failed to read from input', () => {
      it('should throw an error', async() => {
        const expected = new Error('foo');
        const input = new MockReadable(null, expected);
        const store = new PropertiesStore();

        try {
          await store.load(input);
          // Should have thrown
          assert.fail();
        } catch (e) {
          assert.strictEqual(e, expected);
        }

        assert.equal(store.size, 0);
      });
    });

    context('when encoding option is not specified', () => {
      it('should read input using latin1 encoding', async() => {
        const input = new MockReadable(Buffer.from('foo¥bar=fu¥baz'));
        const expected = [
          [ Buffer.from('foo¥bar').toString('latin1'), Buffer.from('fu¥baz').toString('latin1') ]
        ];
        const store = new PropertiesStore();

        await store.load(input);

        assert.deepEqual(Array.from(store), expected);
      });
    });

    context('when encoding option is specified', () => {
      it('should read input using encoding', async() => {
        const input = new MockReadable(Buffer.from('foo¥bar=fu¥baz'));
        const expected = [
          [ 'foo¥bar', 'fu¥baz' ]
        ];
        const store = new PropertiesStore();

        await store.load(input, { encoding: 'utf8' });

        assert.deepEqual(Array.from(store), expected);
      });
    });
  });

  describe('#set', () => {
    context('when no property exists for key', () => {
      it('should set property value for key and return PropertiesStore', () => {
        const expected = [
          [ 'foo', 'bar' ]
        ];
        const store = new PropertiesStore();

        assert.strictEqual(store.set('foo', 'bar'), store);

        assert.deepEqual(Array.from(store), expected);
      });

      it('should emit "change" event but not "delete" event', () => {
        const changeCallback = sinon.spy();
        const deleteCallback = sinon.spy();
        const store = new PropertiesStore();

        store.on('change', changeCallback);
        store.on('delete', deleteCallback);

        assert.strictEqual(store.set('foo', 'bar'), store);

        assert.equal(changeCallback.callCount, 1);
        assert.equal(deleteCallback.callCount, 0);

        const changeCalls = changeCallback.getCalls();

        assert.deepEqual(changeCalls[0].args, [
          {
            key: 'foo',
            newValue: 'bar',
            oldValue: undefined,
            properties: store
          }
        ]);
      });

      context('and value is null', () => {
        it('should not remove any property and return PropertiesStore', () => {
          const store = new PropertiesStore();

          assert.strictEqual(store.set('foo', null), store);

          assert.equal(store.size, 0);
        });

        it('should not emit "change" or "delete" event', () => {
          const changeCallback = sinon.spy();
          const deleteCallback = sinon.spy();
          const store = new PropertiesStore();

          store.on('change', changeCallback);
          store.on('delete', deleteCallback);

          assert.strictEqual(store.set('foo', null), store);

          assert.equal(changeCallback.callCount, 0);
          assert.equal(deleteCallback.callCount, 0);
        });
      });
    });

    context('when property exists for key', () => {
      it('should set property value for key and return PropertiesStore', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const expected = [
          [ 'foo', 'quux' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.strictEqual(store.set('foo', 'quux'), store);

        assert.deepEqual(Array.from(store), expected);
      });

      it('should emit "change" event but not "delete" event', () => {
        const changeCallback = sinon.spy();
        const deleteCallback = sinon.spy();
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        store.on('change', changeCallback);
        store.on('delete', deleteCallback);

        assert.strictEqual(store.set('foo', 'quux'), store);

        assert.equal(changeCallback.callCount, 1);
        assert.equal(deleteCallback.callCount, 0);

        const changeCalls = changeCallback.getCalls();

        assert.deepEqual(changeCalls[0].args, [
          {
            key: 'foo',
            newValue: 'quux',
            oldValue: 'bar',
            properties: store
          }
        ]);
      });

      context('and value is same as existing', () => {
        it('should not emit "change" or "delete" event', () => {
          const changeCallback = sinon.spy();
          const deleteCallback = sinon.spy();
          const store = new PropertiesStore();

          assert.strictEqual(store.set('foo', 'bar'), store);

          store.on('change', changeCallback);
          store.on('delete', deleteCallback);

          assert.strictEqual(store.set('foo', 'bar'), store);

          assert.equal(changeCallback.callCount, 0);
          assert.equal(deleteCallback.callCount, 0);
        });
      });

      context('and value is null', () => {
        it('should remove property for key and return PropertiesStore', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'fu', 'baz' ],
            [ 'fizz', 'buzz' ]
          ];
          const expected = [
            [ 'fu', 'baz' ],
            [ 'fizz', 'buzz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.strictEqual(store.set('foo', null), store);

          assert.deepEqual(Array.from(store), expected);
        });

        it('should emit "delete" event but not "change" event', () => {
          const changeCallback = sinon.spy();
          const deleteCallback = sinon.spy();
          const properties = [
            [ 'foo', 'bar' ],
            [ 'fu', 'baz' ],
            [ 'fizz', 'buzz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          store.on('change', changeCallback);
          store.on('delete', deleteCallback);

          assert.strictEqual(store.set('foo', null), store);

          assert.equal(changeCallback.callCount, 0);
          assert.equal(deleteCallback.callCount, 1);

          const deleteCalls = deleteCallback.getCalls();

          assert.deepEqual(deleteCalls[0].args, [
            {
              key: 'foo',
              properties: store,
              value: 'bar'
            }
          ]);
        });
      });
    });

    context('when key is using different case', () => {
      it('should set property value for key and return PropertiesStore', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'FU', 'baz' ]
        ];
        const expected = [
          [ 'foo', 'bar' ],
          [ 'FU', 'baz' ],
          [ 'FOO', 'buzz' ],
          [ 'fu', 'quux' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.strictEqual(store.set('FOO', 'buzz'), store);
        assert.strictEqual(store.set('fu', 'quux'), store);

        assert.deepEqual(Array.from(store), expected);
      });

      it('should emit "change" event but not "delete" event', () => {
        const changeCallback = sinon.spy();
        const deleteCallback = sinon.spy();
        const properties = [
          [ 'foo', 'bar' ],
          [ 'FU', 'baz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        store.on('change', changeCallback);
        store.on('delete', deleteCallback);

        assert.strictEqual(store.set('FOO', 'buzz'), store);
        assert.strictEqual(store.set('fu', 'quux'), store);

        assert.equal(changeCallback.callCount, 2);
        assert.equal(deleteCallback.callCount, 0);

        const changeCalls = changeCallback.getCalls();

        assert.deepEqual(changeCalls[0].args, [
          {
            key: 'FOO',
            newValue: 'buzz',
            oldValue: undefined,
            properties: store
          }
        ]);
        assert.deepEqual(changeCalls[1].args, [
          {
            key: 'fu',
            newValue: 'quux',
            oldValue: undefined,
            properties: store
          }
        ]);
      });

      context('and value is null', () => {
        it('should not remove any property and return PropertiesStore', () => {
          const properties = [
            [ 'foo', 'bar' ],
            [ 'FU', 'baz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          assert.equal(store.set('FOO', null), store);
          assert.equal(store.set('fu', null), store);

          assert.deepEqual(Array.from(store), properties);
        });

        it('should not emit "change" or "delete" event', () => {
          const changeCallback = sinon.spy();
          const deleteCallback = sinon.spy();
          const properties = [
            [ 'foo', 'bar' ],
            [ 'FU', 'baz' ]
          ];
          const store = new PropertiesStore();

          for (const [ key, value ] of properties) {
            store.set(key, value);
          }

          store.on('change', changeCallback);
          store.on('delete', deleteCallback);

          assert.strictEqual(store.set('FOO', null), store);
          assert.strictEqual(store.set('fu', null), store);

          assert.equal(changeCallback.callCount, 0);
          assert.equal(deleteCallback.callCount, 0);
        });
      });
    });

    context('when key is null', () => {
      it('should not change or remove any property and return PropertiesStore', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.strictEqual(store.set(null, 'quxx'), store);
        assert.strictEqual(store.set(null, null), store);

        assert.deepEqual(Array.from(store), properties);
      });

      it('should not emit "change" or "delete" event', () => {
        const changeCallback = sinon.spy();
        const deleteCallback = sinon.spy();
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        store.on('change', changeCallback);
        store.on('delete', deleteCallback);

        assert.strictEqual(store.set(null, 'quxx'), store);
        assert.strictEqual(store.set(null, null), store);

        assert.equal(changeCallback.callCount, 0);
        assert.equal(deleteCallback.callCount, 0);
      });
    });
  });

  describe('#store', () => {
    it('should write property lines to output', async() => {
      const output = new MockWritable();
      const expected = [
        'foo=bar',
        'fu=baz'
      ].reduce((memo, value) => `${memo}${value}${EOL}`, '');
      const store = new PropertiesStore();
      store.set('foo', 'bar');
      store.set('fu', 'baz');

      await store.store(output);

      assert.equal(output.buffer.toString('latin1'), expected);
    });

    it('should emit "store" event', async() => {
      const storeCallback = sinon.spy();
      const output = new MockWritable();
      const store = new PropertiesStore();
      store.set('foo', 'bar');
      store.set('fu', 'baz');

      store.on('store', storeCallback);

      await store.store(output);

      assert.equal(storeCallback.callCount, 1);

      const storeCalls = storeCallback.getCalls();

      assert.deepEqual(storeCalls[0].args, [
        {
          options: {
            encoding: 'latin1',
            escapeUnicode: true
          },
          output,
          properties: store
        }
      ]);
    });

    context('when no properties exist', () => {
      it('should write empty buffer to output', async() => {
        const output = new MockWritable();
        const expected = '';
        const store = new PropertiesStore();

        await store.store(output);

        assert.equal(output.buffer.toString('latin1'), expected);
      });

      it('should emit "store" event', async() => {
        const storeCallback = sinon.spy();
        const output = new MockWritable();
        const store = new PropertiesStore();

        store.on('store', storeCallback);

        await store.store(output);

        assert.equal(storeCallback.callCount, 1);

        const storeCalls = storeCallback.getCalls();

        assert.deepEqual(storeCalls[0].args, [
          {
            options: {
              encoding: 'latin1',
              escapeUnicode: true
            },
            output,
            properties: store
          }
        ]);
      });
    });

    context('when failed to write to output', () => {
      it('should throw an error', async() => {
        const expectedError = new Error('foo');
        const output = new MockWritable(null, expectedError);
        const expectedOutput = '';
        const store = new PropertiesStore();
        store.set('foo', 'bar');
        store.set('fu', 'baz');

        try {
          await store.store(output);
          // Should have thrown
          assert.fail();
        } catch (e) {
          assert.strictEqual(e, expectedError);
        }

        assert.equal(output.buffer.toString('latin1'), expectedOutput);
      });
    });

    context('when encoding option is not specified', () => {
      it('should write output using latin1 encoding', async() => {
        const output = new MockWritable();
        const expected = `foo\\u00a5bar=fu\\u00a5baz${EOL}`;

        const store = new PropertiesStore();
        store.set('foo¥bar', 'fu¥baz');

        await store.store(output);

        assert.equal(output.buffer.toString('latin1'), expected);
      });
    });

    context('when encoding option is specified', () => {
      it('should write output using encoding', async() => {
        const output = new MockWritable();
        const expected = `foo\\u00a5bar=fu\\u00a5baz${EOL}`;

        const store = new PropertiesStore();
        store.set('foo¥bar', 'fu¥baz');

        await store.store(output, { encoding: 'ascii' });

        assert.equal(output.buffer.toString('ascii'), expected);
      });
    });

    context('when escapeUnicode option is disabled', () => {
      it('should write non-ASCII characters to output as-is', async() => {
        const output = new MockWritable();
        const expected = `foo¥bar=fu¥baz${EOL}`;

        const store = new PropertiesStore();
        store.set('foo¥bar', 'fu¥baz');

        await store.store(output, {
          encoding: 'utf8',
          escapeUnicode: false
        });

        assert.equal(output.buffer.toString('utf8'), expected);
      });
    });

    context('when escapeUnicode option is enabled', () => {
      it('should escape non-ASCII characters before being written to output', async() => {
        const output = new MockWritable();
        const expected = `foo\\u00a5bar=fu\\u00a5baz${EOL}`;

        const store = new PropertiesStore();
        store.set('foo¥bar', 'fu¥baz');

        await store.store(output, {
          encoding: 'utf8',
          escapeUnicode: true
        });

        assert.equal(output.buffer.toString('utf8'), expected);
      });
    });
  });

  describe('#values', () => {
    it('should return iterator for each property value', () => {
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const expected = properties.map(([ key, value ]) => value);
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      const iterator = store.values();

      assert.equal(iterator.next().value, 'bar');
      assert.equal(iterator.next().value, 'baz');
      assert.equal(iterator.next().value, 'buzz');
      assert.strictEqual(iterator.next().value, undefined);

      assert.deepEqual(Array.from(store.values()), expected);
    });

    context('when no properties exist', () => {
      it('should return an empty iterator', () => {
        const store = new PropertiesStore();
        const iterator = store.values();

        assert.strictEqual(iterator.next().value, undefined);

        assert.deepEqual(Array.from(store.values()), []);
      });
    });
  });

  describe('#[Symbol.iterator]', () => {
    it('should return iterator for each property key/value pair', () => {
      const properties = [
        [ 'foo', 'bar' ],
        [ 'fu', 'baz' ],
        [ 'fizz', 'buzz' ]
      ];
      const store = new PropertiesStore();

      for (const [ key, value ] of properties) {
        store.set(key, value);
      }

      const iterator = store[Symbol.iterator]();

      assert.deepEqual(iterator.next().value, [ 'foo', 'bar' ]);
      assert.deepEqual(iterator.next().value, [ 'fu', 'baz' ]);
      assert.deepEqual(iterator.next().value, [ 'fizz', 'buzz' ]);
      assert.strictEqual(iterator.next().value, undefined);

      assert.deepEqual(Array.from(store), properties);
    });

    context('when no properties exist', () => {
      it('should return an empty iterator', () => {
        const store = new PropertiesStore();
        const iterator = store[Symbol.iterator]();

        assert.strictEqual(iterator.next().value, undefined);

        assert.deepEqual(Array.from(store), []);
      });
    });
  });

  describe('#size', () => {
    describe('(get)', () => {
      it('should return number of properties', () => {
        const properties = [
          [ 'foo', 'bar' ],
          [ 'fu', 'baz' ],
          [ 'fizz', 'buzz' ]
        ];
        const store = new PropertiesStore();

        for (const [ key, value ] of properties) {
          store.set(key, value);
        }

        assert.equal(store.size, 3);
      });

      context('when no properties exist', () => {
        it('should return zero', () => {
          const store = new PropertiesStore();

          assert.equal(store.size, 0);
        });
      });
    });

    describe('(set)', () => {
      it('should throw an error', () => {
        const store = new PropertiesStore();

        assert.throws(() => {
          store.size = 123;
        }, TypeError);
      });
    });
  });
});
