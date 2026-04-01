import { describe, it, expect } from 'vitest';
import { isBlockedIp } from '@assistai/shared';

/**
 * SSRF protection unit tests (A-092).
 *
 * Tests the IP blocking logic for BYO endpoint validation.
 */
describe('isBlockedIp', () => {
  it('blocks loopback 127.0.0.1', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
  });

  it('blocks loopback 127.x.x.x range', () => {
    expect(isBlockedIp('127.0.0.2')).toBe(true);
    expect(isBlockedIp('127.255.255.255')).toBe(true);
  });

  it('blocks RFC1918 10.x.x.x', () => {
    expect(isBlockedIp('10.0.0.1')).toBe(true);
    expect(isBlockedIp('10.255.255.255')).toBe(true);
  });

  it('blocks RFC1918 172.16.x.x through 172.31.x.x', () => {
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('172.31.255.255')).toBe(true);
  });

  it('allows 172.15.x.x and 172.32.x.x', () => {
    expect(isBlockedIp('172.15.0.1')).toBe(false);
    expect(isBlockedIp('172.32.0.1')).toBe(false);
  });

  it('blocks RFC1918 192.168.x.x', () => {
    expect(isBlockedIp('192.168.0.1')).toBe(true);
    expect(isBlockedIp('192.168.255.255')).toBe(true);
  });

  it('blocks link-local / metadata 169.254.x.x', () => {
    expect(isBlockedIp('169.254.0.1')).toBe(true);
    expect(isBlockedIp('169.254.169.254')).toBe(true); // AWS metadata
  });

  it('blocks 0.0.0.0/8', () => {
    expect(isBlockedIp('0.0.0.0')).toBe(true);
    expect(isBlockedIp('0.0.0.1')).toBe(true);
  });

  it('blocks broadcast 255.x.x.x', () => {
    expect(isBlockedIp('255.255.255.255')).toBe(true);
  });

  it('blocks multicast 224-239.x.x.x', () => {
    expect(isBlockedIp('224.0.0.1')).toBe(true);
    expect(isBlockedIp('239.255.255.255')).toBe(true);
  });

  it('allows public IPs', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('1.1.1.1')).toBe(false);
    expect(isBlockedIp('142.250.185.14')).toBe(false); // Google
    expect(isBlockedIp('104.18.32.68')).toBe(false); // Cloudflare
  });

  it('blocks invalid IPs', () => {
    expect(isBlockedIp('not-an-ip')).toBe(true);
    expect(isBlockedIp('256.1.1.1')).toBe(true);
    expect(isBlockedIp('1.2.3')).toBe(true);
  });
});
