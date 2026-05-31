import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { lockBodyScroll, unlockBodyScroll } from '../src/lib/ui/body-scroll-lock.ts';

function createStyle() {
  return {
    paddingRight: '',
    position: '',
    scrollBehavior: '',
    top: '',
    width: '',
  };
}

afterEach(() => {
  unlockBodyScroll();
  unlockBodyScroll();
  delete globalThis.document;
  delete globalThis.window;
});

describe('body scroll lock', () => {
  it('fixes the body at the current scroll position and restores it on release', () => {
    const body = { scrollTop: 0, style: createStyle() };
    const documentElement = { clientWidth: 980, scrollTop: 0, style: createStyle() };
    const scrollCalls = [];

    globalThis.document = { body, documentElement };
    globalThis.window = {
      getComputedStyle: () => ({ paddingRight: '4px' }),
      innerWidth: 1000,
      scrollTo: (...args) => scrollCalls.push(args),
      scrollX: 7,
      scrollY: 240,
    };

    const release = lockBodyScroll();

    assert.equal(documentElement.style.scrollBehavior, 'auto');
    assert.equal(body.style.position, 'fixed');
    assert.equal(body.style.top, '-240px');
    assert.equal(body.style.width, '100%');
    assert.equal(body.style.paddingRight, 'calc(4px + 20px)');

    release();

    assert.equal(documentElement.style.scrollBehavior, '');
    assert.equal(body.style.position, '');
    assert.equal(body.style.top, '');
    assert.equal(body.style.width, '');
    assert.equal(body.style.paddingRight, '');
    assert.deepEqual(scrollCalls, [[7, 240]]);
  });

  it('keeps the body locked until nested locks are all released', () => {
    const body = { scrollTop: 0, style: createStyle() };
    const documentElement = { clientWidth: 1000, scrollTop: 0, style: createStyle() };
    const scrollCalls = [];

    globalThis.document = { body, documentElement };
    globalThis.window = {
      getComputedStyle: () => ({ paddingRight: '0px' }),
      innerWidth: 1000,
      scrollTo: (...args) => scrollCalls.push(args),
      scrollX: 0,
      scrollY: 90,
    };

    const releaseFirst = lockBodyScroll();
    const releaseSecond = lockBodyScroll();

    releaseFirst();
    assert.equal(body.style.position, 'fixed');
    assert.deepEqual(scrollCalls, []);

    releaseSecond();
    assert.equal(body.style.position, '');
    assert.deepEqual(scrollCalls, [[0, 90]]);
  });

  it('ignores repeated releases from the same lock', () => {
    const body = { scrollTop: 0, style: createStyle() };
    const documentElement = { clientWidth: 1000, scrollTop: 0, style: createStyle() };
    const scrollCalls = [];

    globalThis.document = { body, documentElement };
    globalThis.window = {
      getComputedStyle: () => ({ paddingRight: '0px' }),
      innerWidth: 1000,
      scrollTo: (...args) => scrollCalls.push(args),
      scrollX: 0,
      scrollY: 120,
    };

    const release = lockBodyScroll();

    release();
    release();

    assert.equal(body.style.position, '');
    assert.deepEqual(scrollCalls, [[0, 120]]);
  });
});
