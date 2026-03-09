import { calculateLmi } from '../web/src/utils/calculator.js';
import { writeFileSync } from 'fs';

// Test cases as JSON input/output pairs
const testCases = [];

// Test 1: Basic calculation with default parameters
console.log('\n=== Test 1: Basic Calculation ===');
const test1Input = {
  runtime: 'python',
  targetConcurrency: 100,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 1_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'none',
  workloadType: 'balanced',
  azConfig: '3az',
};
const test1Output = calculateLmi(test1Input);
testCases.push({ name: 'Basic Calculation', input: test1Input, output: test1Output });
console.log('✓ Test 1 completed');

// Test 2: IO-Heavy workload
console.log('\n=== Test 2: IO-Heavy Workload ===');
const test2Input = {
  runtime: 'python',
  targetConcurrency: 100,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 1_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'none',
  workloadType: 'io-heavy',
  azConfig: '3az',
};
const test2Output = calculateLmi(test2Input);
testCases.push({ name: 'IO-Heavy Workload', input: test2Input, output: test2Output });
console.log('✓ Test 2 completed');

// Test 3: CPU-Heavy workload
console.log('\n=== Test 3: CPU-Heavy Workload ===');
const test3Input = {
  runtime: 'python',
  targetConcurrency: 100,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 1_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'none',
  workloadType: 'cpu-heavy',
  azConfig: '3az',
};
const test3Output = calculateLmi(test3Input);
testCases.push({ name: 'CPU-Heavy Workload', input: test3Input, output: test3Output });
console.log('✓ Test 3 completed');

// Test 4: High volume with Compute SP 1yr
console.log('\n=== Test 4: High Volume with Compute SP 1yr ===');
const test4Input = {
  runtime: 'python',
  targetConcurrency: 100,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 10_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'compute_sp_1yr',
  workloadType: 'balanced',
  azConfig: '3az',
};
const test4Output = calculateLmi(test4Input);
testCases.push({ name: 'High Volume with Compute SP 1yr', input: test4Input, output: test4Output });
console.log('✓ Test 4 completed');

// Test 5: Compute SP 3yr
console.log('\n=== Test 5: Compute SP 3yr ===');
const test5Input = {
  runtime: 'python',
  targetConcurrency: 100,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 10_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'compute_sp_3yr',
  workloadType: 'balanced',
  azConfig: '3az',
};
const test5Output = calculateLmi(test5Input);
testCases.push({ name: 'Compute SP 3yr', input: test5Input, output: test5Output });
console.log('✓ Test 5 completed');

// Test 6: EC2 packing efficiency 50%
console.log('\n=== Test 6: EC2 Packing Efficiency 50% ===');
const test6Input = {
  runtime: 'python',
  targetConcurrency: 100,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 1_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'none',
  workloadType: 'balanced',
  azConfig: '3az',
  ec2PackingEfficiency: 50,
};
const test6Output = calculateLmi(test6Input);
testCases.push({ name: 'EC2 Packing Efficiency 50%', input: test6Input, output: test6Output });
console.log('✓ Test 6 completed');

// Test 7: EC2 packing efficiency 80%
console.log('\n=== Test 7: EC2 Packing Efficiency 80% ===');
const test7Input = {
  runtime: 'python',
  targetConcurrency: 100,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 1_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'none',
  workloadType: 'balanced',
  azConfig: '3az',
  ec2PackingEfficiency: 80,
};
const test7Output = calculateLmi(test7Input);
testCases.push({ name: 'EC2 Packing Efficiency 80%', input: test7Input, output: test7Output });
console.log('✓ Test 7 completed');

// Test 8: Low concurrency (50)
console.log('\n=== Test 8: Low Concurrency (50) ===');
const test8Input = {
  runtime: 'python',
  targetConcurrency: 50,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 1_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'none',
  workloadType: 'balanced',
  azConfig: '3az',
};
const test8Output = calculateLmi(test8Input);
testCases.push({ name: 'Low Concurrency (50)', input: test8Input, output: test8Output });
console.log('✓ Test 8 completed');

// Test 9: High concurrency (200)
console.log('\n=== Test 9: High Concurrency (200) ===');
const test9Input = {
  runtime: 'python',
  targetConcurrency: 200,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 1_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'none',
  workloadType: 'balanced',
  azConfig: '3az',
};
const test9Output = calculateLmi(test9Input);
testCases.push({ name: 'High Concurrency (200)', input: test9Input, output: test9Output });
console.log('✓ Test 9 completed');

// Test 10: 5 AZ configuration
console.log('\n=== Test 10: 5 AZ Configuration ===');
const test10Input = {
  runtime: 'python',
  targetConcurrency: 100,
  memoryPerExec: 512,
  instanceType: 'c7g.xlarge',
  requestsPerMonth: 1_000_000,
  durationSec: 60,
  arch: 'arm64',
  savingsPlan: 'none',
  workloadType: 'balanced',
  azConfig: '5az',
};
const test10Output = calculateLmi(test10Input);
testCases.push({ name: '5 AZ Configuration', input: test10Input, output: test10Output });
console.log('✓ Test 10 completed');

// Write test cases to JSON file
const outputPath = 'tests/test-cases.json';
writeFileSync(outputPath, JSON.stringify(testCases, null, 2));
console.log(`\n✓ All test cases saved to ${outputPath}`);
console.log(`  Total test cases: ${testCases.length}\n`);
