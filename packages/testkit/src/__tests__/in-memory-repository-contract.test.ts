/**
 * @symphony/testkit — __tests__/in-memory-repository-contract.test.ts
 *
 * Runs the repository contract suite against InMemoryRepository.
 * No database required — pure in-memory implementation.
 */

import { describe } from 'vitest';
import { InMemoryRepository } from '../repositories/in-memory-repository.js';
import { runRepositoryContract } from '../contract-suite/repository-contract.js';

describe('InMemoryRepository', () => {
  runRepositoryContract(() => new InMemoryRepository());
});
