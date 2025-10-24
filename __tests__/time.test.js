import { formatSeconds } from '../src/utils/time';

describe('formatSeconds', () => {
  it('formats 0 correctly', () => {
    expect(formatSeconds(0)).toEqual({ minutes: '00', seconds: '00' });
  });
  it('formats under 10 seconds with padding', () => {
    expect(formatSeconds(7)).toEqual({ minutes: '00', seconds: '07' });
  });
  it('formats minutes and seconds with padding', () => {
    expect(formatSeconds(5 * 60 + 9)).toEqual({ minutes: '05', seconds: '09' });
  });
  it('handles negative and non-integer input', () => {
    expect(formatSeconds(-3.4)).toEqual({ minutes: '00', seconds: '00' });
  });
});

