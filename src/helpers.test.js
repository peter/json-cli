const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { stats } = require('./helpers');
const _ = require('lodash');

describe('stats', () => {
    it('should return the correct stats', () => {
        const data = [1, 2, 3, 4, 5];
        const result = stats(data);
        assert.strictEqual(result.min, 1);
        assert.strictEqual(result.max, 5);
        assert.strictEqual(result.avg, 3);
        assert.strictEqual(result.p50, 3);
        assert.strictEqual(result.p90, 4.6);
        assert.strictEqual(result.sum, 15);
        assert.strictEqual(_.round(result.stdDev, 2), 1.41);
        assert.strictEqual(result.count, 5);
    });
});
