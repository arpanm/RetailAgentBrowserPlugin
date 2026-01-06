/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { extractAjioProducts } from '../../src/content/platforms/ajio-platform.js';
import { extractJioMartProducts } from '../../src/content/platforms/jiomart-platform.js';
import { extractRelianceDigitalProducts } from '../../src/content/platforms/reliancedigital-platform.js';
import { extractTiraBeautyProducts } from '../../src/content/platforms/tirabeauty-platform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  const html = fs.readFileSync(path.join(__dirname, `../fixtures/${name}`), 'utf-8');
  const dom = new JSDOM(html, { url: 'https://example.com' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.DOMParser = dom.window.DOMParser;
  Object.assign(global, dom.window);
}

describe('Platform extraction', () => {
  it('Ajio extracts products', () => {
    loadFixture('ajio-search.html');
    const products = extractAjioProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].platform).toBe('ajio');
    expect(products[0].title).toMatch(/Dennis Lingo/i);
  });

  it('JioMart extracts products', () => {
    loadFixture('jiomart-search.html');
    const products = extractJioMartProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].platform).toBe('jiomart');
    expect(products[0].title).toMatch(/Noise Buds Trance/i);
  });

  it('RelianceDigital extracts products', () => {
    loadFixture('reliancedigital-search.html');
    const products = extractRelianceDigitalProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].platform).toBe('reliancedigital');
    expect(products[0].title).toMatch(/Galaxy F17/i);
  });

  it('TiraBeauty extracts products', () => {
    loadFixture('tirabeauty-search.html');
    const products = extractTiraBeautyProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].platform).toBe('tirabeauty');
    expect(products[0].title).toMatch(/Be Bodywise/i);
  });
});

