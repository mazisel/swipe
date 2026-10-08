import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TapGesture, tapActivation } from '../shared/tapGesture.ts';
const point = (pageX, pageY = 100) => ({ pageX, pageY });

test('left swipe stays cancelled with reused event coordinates and coordinate-free activation', () => {
  const tap = new TapGesture(), event = point(240);
  tap.begin(event); event.pageX = 80; tap.move(event);
  assert.equal(tap.allows(), false);
  assert.equal(tapActivation({ nativeEvent: { detail: 0 } }).keyboard, false);
  assert.equal(tapActivation({ type: 'click', pageX: 80, pageY: 100 }).keyboard, false);
  assert.deepEqual(tapActivation({ type: 'click', pageX: 80, pageY: 100 }).point, point(80));
  assert.equal(tapActivation({ type: 'keyup', key: 'Enter' }).keyboard, true);
});

test('navigation accepts a steady tap but rejects the reported short DM drag', () => {
  const tap = new TapGesture();
  tap.begin(point(309, 430));
  assert.equal(tap.allows(point(313, 433)), true);
  tap.begin(point(309, 430));
  assert.equal(tap.allows(point(289, 430)), false);
});
test('dragging out and back onto a menu tab never becomes a tap', () => {
  const tap = new TapGesture();
  tap.begin(point(100)); tap.move(point(150)); tap.move(point(100));
  assert.equal(tap.allows(point(100)), false);
  // A new deliberate tap is immediately usable; no arbitrary cooldown.
  tap.begin(point(100));
  assert.equal(tap.allows(point(100)), true);
});
test('vertical, diagonal, cancelled and multi-finger movements cannot navigate', () => {
  for (const move of [point(100, 120), point(108, 108)]) {
    const tap = new TapGesture(); tap.begin(point(100)); tap.move(move);
    assert.equal(tap.allows(point(100)), false);
  }
  const tap = new TapGesture(); tap.begin(point(100)); tap.move(point(100), 2);
  assert.equal(tap.allows(point(100)), false);
  tap.begin(point(100)); tap.cancel();
  assert.equal(tap.allows(point(100)), false);
});
