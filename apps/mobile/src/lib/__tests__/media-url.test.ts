import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from '../media-url';

describe('resolveMediaUrl', () => {
  const api = 'http://10.110.14.12:4000';

  it('points localhost uploads at the API host the phone uses', () => {
    expect(resolveMediaUrl('http://localhost:4000/media/a.mp4', api)).toBe('http://10.110.14.12:4000/media/a.mp4');
    expect(resolveMediaUrl('http://127.0.0.1:4000/media/a.mp4?v=2', api)).toBe('http://10.110.14.12:4000/media/a.mp4?v=2');
  });

  it('leaves real URLs, local files and empty values alone', () => {
    expect(resolveMediaUrl('https://cdn.example.com/a.mp4', api)).toBe('https://cdn.example.com/a.mp4');
    expect(resolveMediaUrl('file:///data/a.mp4', api)).toBe('file:///data/a.mp4');
    expect(resolveMediaUrl('http://localhost:4000/media/a.mp4', 'http://localhost:4000')).toBe('http://localhost:4000/media/a.mp4');
    expect(resolveMediaUrl(null, api)).toBeNull();
    expect(resolveMediaUrl('not a url', api)).toBe('not a url');
  });
});
