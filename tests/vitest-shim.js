import { describe, it, test, beforeAll, afterAll, beforeEach, afterEach, expect, jest } from '@jest/globals';

export const vi = {
  fn: (...args) => jest.fn(...args),
  spyOn: (...args) => jest.spyOn(...args),
  mock: (...args) => jest.mock(...args),
};
export default vi;

export {
  describe,
  it,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
  jest,
};

