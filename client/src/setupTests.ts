import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for JSDOM (required by react-router v7)
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder as any;
}
