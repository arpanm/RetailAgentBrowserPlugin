import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fs from 'fs';
import path from 'path';

describe('selector regression harness', () => {
    const fixtures = [
        path.join(__dirname, '../fixtures/amazon-search.html'),
        path.join(__dirname, '../fixtures/flipkart-search.html'),
    ];

    it('fixtures exist for amazon and flipkart', () => {
        fixtures.forEach((f) => {
            expect(fs.existsSync(f)).toBe(true);
        });
    });
});

