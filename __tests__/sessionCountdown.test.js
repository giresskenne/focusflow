import React from 'react';
import renderer, { act } from 'react-test-renderer';
import useSessionCountdown from '../src/hooks/useSessionCountdown';

function TestCountdown({ endAt, total }) {
  const { seconds, progress } = useSessionCountdown(endAt, total, 1000);
  return (
    <>
      <span testID="seconds">{seconds}</span>
      <span testID="progress">{progress}</span>
    </>
  );
}

jest.useFakeTimers();

describe('useSessionCountdown', () => {
  it('counts down based on absolute endAt without drift', () => {
    const now = Date.now();
    const endAt = now + 5000; // 5s
    const total = 5;

    const component = renderer.create(<TestCountdown endAt={endAt} total={total} />);

    // Initially ~5 seconds remaining
    let secs = component.root.findAllByProps({ testID: 'seconds' })[0].children[0];
    expect(Number(secs)).toBeGreaterThanOrEqual(4);

    // Advance 3 seconds
    act(() => { jest.advanceTimersByTime(3000); });
    secs = component.root.findAllByProps({ testID: 'seconds' })[0].children[0];
    // Remaining should be about 2
    expect(Number(secs)).toBeGreaterThanOrEqual(1);
    expect(Number(secs)).toBeLessThanOrEqual(2);

    // Advance past end
    act(() => { jest.advanceTimersByTime(4000); });
    secs = component.root.findAllByProps({ testID: 'seconds' })[0].children[0];
    expect(Number(secs)).toBe(0);
  });
});
