// Lambda Managed Instances Calculator Logic (v2)
// Recalibrated with Zach's Elevator savings contribution data

// ---------------------------------------------------------------------------
// Workload & Traffic Profiles (from Zach's analysis)
// ---------------------------------------------------------------------------

export const WORKLOAD_TYPES = {
  'io-heavy':   { name: 'IO-Heavy (Proxy/Queue)',  defaultMC: 6, utilizationFactor: 0.125 }, // Each invocation uses 12.5% CPU → 8 concurrent per vCPU
  'balanced':   { name: 'Balanced (Mixed)',        defaultMC: 2, utilizationFactor: 0.25 }, // Each invocation uses 25% CPU → 4 concurrent per vCPU
  'cpu-heavy':  { name: 'CPU-Heavy (Compute)',     defaultMC: 2, utilizationFactor: 0.50 }, // Each invocation uses 50% CPU → 2 concurrent per vCPU
};

export const TRAFFIC_PATTERNS = {
  'steady':      { name: 'Steady State',    scalingBuffer: 1.25 },
  'predictable': { name: 'Predictable',     scalingBuffer: 1.25 },
  'bursty':      { name: 'Bursty',          scalingBuffer: 2.0  },
  'flash':       { name: 'Flash Processing', scalingBuffer: 10.0 },
};

export const PERFORMANCE_PROFILES = {
  'latency-sensitive': { name: 'IO-Heavy (Proxy/Queue)', cpuTarget: 0.30, lambdaCpuUsage: 12.5 },
  'balanced':          { name: 'Balanced (Mixed)',       cpuTarget: 0.40, lambdaCpuUsage: 25 },
  'cost-optimized':    { name: 'CPU-Heavy (Compute)',    cpuTarget: 0.50, lambdaCpuUsage: 50 },
};

export const AZ_CONFIGS = {
  '3az':  { name: '3 AZ (Standard)',        buffer: 1.50, minInstances: 3 },
  '5az':  { name: '5 AZ (High Resilience)', buffer: 1.25, minInstances: 5 },
  'none': { name: 'No AZ Buffer',           buffer: 1.0,  minInstances: 1 },
};


// ---------------------------------------------------------------------------
// Pricing Constants (validated against official AWS sources)
// ---------------------------------------------------------------------------

export const RUNTIME_LIMITS = {
  nodejs: 64, java: 32, dotnet: 32, python: 16,
};

export const INSTANCE_TYPES = {
  'c7g.xlarge':  { vcpus: 4,  memory_gb: 8,   price_hourly: 0.1450 },
  'c7g.2xlarge': { vcpus: 8,  memory_gb: 16,  price_hourly: 0.2900 },
  'c7g.4xlarge': { vcpus: 16, memory_gb: 32,  price_hourly: 0.5800 },
  'm7g.xlarge':  { vcpus: 4,  memory_gb: 16,  price_hourly: 0.1632 },
  'm7g.2xlarge': { vcpus: 8,  memory_gb: 32,  price_hourly: 0.3264 },
  'm7g.4xlarge': { vcpus: 16, memory_gb: 64,  price_hourly: 0.6528 },
  'r7g.xlarge':  { vcpus: 4,  memory_gb: 32,  price_hourly: 0.2140 },
  'r7g.2xlarge': { vcpus: 8,  memory_gb: 64,  price_hourly: 0.4280 },
  'r7g.4xlarge': { vcpus: 16, memory_gb: 128, price_hourly: 0.8570 },
};

// Recalibrated savings plans from Zach's assumption options
// Lambda SP: 1yr=12%, 3yr=12%  |  EC2 SP: 1yr=32%, 3yr=65%
export const SAVINGS_PLANS = {
  none:           { name: 'On-Demand',                     lmi_discount: 0,    lambda_discount: 0    },
  compute_sp_1yr: { name: 'Compute Savings Plan (1yr)',     lmi_discount: 0.32, lambda_discount: 0.12 },
  compute_sp_3yr: { name: 'Compute Savings Plan (3yr)',     lmi_discount: 0.65, lambda_discount: 0.12 },
  ec2_instance_sp:{ name: 'EC2 Instance Savings Plan (1yr)',lmi_discount: 0.32, lambda_discount: 0    },
  reserved_3yr:   { name: 'Reserved Instance (3yr)',        lmi_discount: 0.65, lambda_discount: 0    },
};

const LAMBDA_REQUEST_PRICE = 0.20 / 1_000_000;
const LMI_REQUEST_PRICE    = 0.20 / 1_000_000;
const LMI_MANAGEMENT_FEE   = 0.15;
const HOURS_PER_MONTH      = 730;

// Import pricing data
import lambdaPricingByMemory from '../assets/lambda-pricing-by-memory.json' assert { type: 'json' };

export const LMI_PACKING_EFFICIENCY = 0.80;
export const EC2_PACKING_EFFICIENCY = 0.60;


// ---------------------------------------------------------------------------
// Core capacity functions
// ---------------------------------------------------------------------------

export function computeConcurrencyPerVcpu(runtime, memoryPerExecMb, memVcpuRatio) {
  const runtimeLimit = RUNTIME_LIMITS[runtime];
  const memoryPerVcpuMb = memVcpuRatio * 1024;
  const memoryLimit = Math.floor(memoryPerVcpuMb / memoryPerExecMb);
  return Math.max(1, Math.min(runtimeLimit, memoryLimit));
}

export function computeFunctionMemoryMb(memoryPerExecMb, concurrencyPerVcpu) {
  return Math.max(2048, Math.ceil(memoryPerExecMb * concurrencyPerVcpu));
}

export function computeVcpusFromMemory(functionMemoryMb, memVcpuRatio) {
  return Math.ceil(functionMemoryMb / (memVcpuRatio * 1024));
}

export function computeEnvironmentsNeeded(targetConcurrency, concurrencyPerEnv) {
  return Math.ceil(targetConcurrency / concurrencyPerEnv);
}

export function computeInstancesNeeded(environments, envsPerInstance, minInstances) {
  if (!envsPerInstance || envsPerInstance <= 0) return Infinity;
  return Math.max(minInstances, Math.ceil(environments / envsPerInstance));
}

export function computeEnvsPerInstance(instanceType, functionMemoryMb, vcpusPerEnv) {
  const inst = INSTANCE_TYPES[instanceType];
  if (!inst) return 0;
  const usableVcpus = inst.vcpus - 1;
  const usableMemMb = (inst.memory_gb * 1024) - 1024;
  if (usableVcpus <= 0 || usableMemMb <= 0 || vcpusPerEnv <= 0 || functionMemoryMb <= 0) return 0;
  return Math.max(1, Math.min(Math.floor(usableVcpus / vcpusPerEnv), Math.floor(usableMemMb / functionMemoryMb)));
}

// Sustainable concurrency based on workload type and latency requirements
export function getSustainableConcurrency(workloadType, runtimeLimit) {
  const wt = WORKLOAD_TYPES[workloadType];
  if (!wt) return runtimeLimit * 0.25; // Default to balanced
  return Math.floor(runtimeLimit * wt.utilizationFactor);
}

// CPU utilization adjustment: baseline 40% / chosen target
export function computeCpuAdjustment(performanceProfile) {
  const p = PERFORMANCE_PROFILES[performanceProfile];
  return p ? (0.40 / p.cpuTarget) : 1.0;
}


// ---------------------------------------------------------------------------
// Cost functions
// ---------------------------------------------------------------------------

export function calcLmiCost(numInstances, instanceType, requestsPerMonth, savingsPlan) {
  const inst = INSTANCE_TYPES[instanceType];
  const plan = SAVINGS_PLANS[savingsPlan] || SAVINGS_PLANS.none;
  const ec2OD = numInstances * inst.price_hourly * HOURS_PER_MONTH;
  const ec2Disc = ec2OD * (1 - plan.lmi_discount);
  const mgmtFee = ec2OD * LMI_MANAGEMENT_FEE;
  const reqCost = requestsPerMonth * LMI_REQUEST_PRICE;
  return {
    ec2_cost: ec2Disc, management_fee: mgmtFee, request_cost: reqCost,
    total_cost: ec2Disc + mgmtFee + reqCost,
    savings_plan: plan.name, discount_rate: plan.lmi_discount,
  };
}

export function calcStandardLambdaCost(requestsPerMonth, durationSec, memoryMb, arch, savingsPlan) {
  const plan = SAVINGS_PLANS[savingsPlan] || SAVINGS_PLANS.none;
  
  // Calculate price per millisecond based on memory
  // Lambda pricing is linear: price scales with memory
  // Use 128MB as base and scale proportionally
  const archKey = arch === 'arm64' ? 'ARM' : 'x86';
  const baseMemory = 128;
  const basePricePerMs = lambdaPricingByMemory[archKey][baseMemory];
  const pricePerMs = basePricePerMs * (memoryMb / baseMemory);
  
  // Calculate total cost
  const durationMs = durationSec * 1000;
  const totalMs = requestsPerMonth * durationMs;
  const computeCost = totalMs * pricePerMs;
  
  // Apply savings plan discount
  const compDisc = computeCost * (1 - plan.lambda_discount);
  const reqCost = requestsPerMonth * LAMBDA_REQUEST_PRICE;
  
  // Calculate GB-seconds for display
  const gbSec = requestsPerMonth * durationSec * (memoryMb / 1024);
  
  return {
    compute_cost: compDisc, 
    request_cost: reqCost, 
    total_cost: compDisc + reqCost,
    gb_seconds: gbSec, 
    savings_plan: plan.name, 
    discount_rate: plan.lambda_discount,
    price_per_ms: pricePerMs,
  };
}

export function calcEc2Cost(numInstancesLmi, instanceType, savingsPlan, ec2PackingEfficiency = null) {
  const inst = INSTANCE_TYPES[instanceType];
  const plan = SAVINGS_PLANS[savingsPlan] || SAVINGS_PLANS.none;
  const ec2Packing = ec2PackingEfficiency && ec2PackingEfficiency > 0 ? ec2PackingEfficiency / 100 : EC2_PACKING_EFFICIENCY;
  const numEc2 = Math.ceil(numInstancesLmi * (LMI_PACKING_EFFICIENCY / ec2Packing));
  const ec2OD = numEc2 * inst.price_hourly * HOURS_PER_MONTH;
  const ec2Disc = ec2OD * (1 - plan.lmi_discount);
  return {
    num_instances: numEc2, ec2_on_demand_monthly: ec2OD, ec2_after_discount: ec2Disc,
    total_cost: ec2Disc, savings_plan: plan.name, discount_rate: plan.lmi_discount,
    packing_efficiency: ec2Packing,
  };
}


// ---------------------------------------------------------------------------
// Suitability score
// ---------------------------------------------------------------------------

function computeSuitabilityScore(workloadType, instanceCount) {
  let score = 100;
  const warnings = [];

  if (instanceCount <= 3) {
    score -= 20;
    warnings.push('Low traffic — need ~45+ TPS for web workloads to justify LMI.');
  }
  if (workloadType === 'cpu-heavy') {
    score -= 10;
    warnings.push('CPU-heavy workloads see lower concurrency gains.');
  }

  score = Math.max(0, Math.min(100, score));
  const rating = score >= 80 ? 'Excellent fit for LMI'
    : score >= 60 ? 'Good fit for LMI'
    : score >= 40 ? 'Marginal — evaluate carefully'
    : 'Poor fit — consider Standard Lambda';

  return { score, rating, warnings };
}


// ---------------------------------------------------------------------------
// Main calculation (v2)
// ---------------------------------------------------------------------------

export function calculateLmi(params) {
  const {
    runtime, targetConcurrency, memoryPerExec, memVcpuRatio = 2,
    instanceType = 'c7g.xlarge', requestsPerMonth = 1_000_000,
    durationSec = 60, arch = 'arm64', savingsPlan = 'none',
    workloadType = 'balanced', azConfig = '3az',
    maxConcurrencyOverride = null, functionMemoryOverride = null,
    envsPerInstanceOverride = null, multiConcurrencyOverride = null,
    ec2PackingEfficiency = null,
  } = params;

  // Validate
  if (targetConcurrency <= 0) throw new Error('Target concurrency must be > 0');
  if (memoryPerExec <= 0) throw new Error('Memory per execution must be > 0');
  if (requestsPerMonth <= 0) throw new Error('Monthly requests must be > 0');
  if (durationSec <= 0) throw new Error('Duration must be > 0');

  // Step 1: Concurrency per vCPU
  const concurrencyPerVcpu = (maxConcurrencyOverride && maxConcurrencyOverride > 0)
    ? maxConcurrencyOverride
    : computeConcurrencyPerVcpu(runtime, memoryPerExec, memVcpuRatio);

  // Step 2: Function memory
  const functionMemoryMb = (functionMemoryOverride && functionMemoryOverride >= 2048)
    ? functionMemoryOverride
    : computeFunctionMemoryMb(memoryPerExec, concurrencyPerVcpu);

  // Step 3: vCPUs per env
  const vcpusPerEnv = computeVcpusFromMemory(functionMemoryMb, memVcpuRatio);

  // Step 4: Sustainable concurrency per env (infer from workload type)
  const workload = WORKLOAD_TYPES[workloadType] || WORKLOAD_TYPES.balanced;
  const lambdaCpuUsage = workload.utilizationFactor * 100;
  
  // Calculate how many concurrent invocations can run at this CPU level
  // If Lambda uses 25% CPU per invocation, can run 100/25 = 4 concurrent
  const concurrentPossible = Math.floor(100 / lambdaCpuUsage);
  const sustainableConcurrencyPerVcpu = Math.min(concurrentPossible, RUNTIME_LIMITS[runtime]);
  const utilizationFactor = lambdaCpuUsage / 100;
  
  const sustainableConcurrencyPerEnv = sustainableConcurrencyPerVcpu * vcpusPerEnv;

  // Step 5: Environments needed
  const environmentsNeeded = computeEnvironmentsNeeded(targetConcurrency, sustainableConcurrencyPerEnv);

  // Step 6: Envs per instance
  const envsPerInstance = (envsPerInstanceOverride && envsPerInstanceOverride > 0)
    ? envsPerInstanceOverride
    : computeEnvsPerInstance(instanceType, functionMemoryMb, vcpusPerEnv);
  if (envsPerInstance <= 0) throw new Error('Cannot fit environments on this instance type.');

  // Step 7: Base instances
  const azCfg = AZ_CONFIGS[azConfig] || AZ_CONFIGS['3az'];
  const baseInstances = computeInstancesNeeded(environmentsNeeded, envsPerInstance, azCfg.minInstances);
  if (!isFinite(baseInstances)) throw new Error('Cannot calculate required instances.');

  // Step 8: Apply fixed scaling buffer (50%) + fixed CPU adjustment
  const SCALING_BUFFER = 1.5; // Fixed 50% buffer for headroom
  const CPU_ADJUSTMENT = 1.0; // No additional CPU adjustment needed
  const instancesWithBuffer = Math.max(azCfg.minInstances,
    Math.ceil(baseInstances * SCALING_BUFFER * CPU_ADJUSTMENT));

  if (instancesWithBuffer > 5000) throw new Error(`Requires ${instancesWithBuffer} instances — unrealistic.`);

  // Costs - calculate all variants for the comparison table
  const lmiCost = calcLmiCost(instancesWithBuffer, instanceType, requestsPerMonth, savingsPlan);
  const stdCost = calcStandardLambdaCost(requestsPerMonth, durationSec, memoryPerExec, arch, savingsPlan);
  const ec2Cost = calcEc2Cost(instancesWithBuffer, instanceType, savingsPlan, ec2PackingEfficiency);

  // All pricing variants for comparison table
  const pricingVariants = {
    lambda: {
      onDemand: calcStandardLambdaCost(requestsPerMonth, durationSec, memoryPerExec, arch, 'none'),
      computeSP1yr: calcStandardLambdaCost(requestsPerMonth, durationSec, memoryPerExec, arch, 'compute_sp_1yr'),
      computeSP3yr: calcStandardLambdaCost(requestsPerMonth, durationSec, memoryPerExec, arch, 'compute_sp_3yr'),
    },
    lmi: {
      onDemand: calcLmiCost(instancesWithBuffer, instanceType, requestsPerMonth, 'none'),
      computeSP1yr: calcLmiCost(instancesWithBuffer, instanceType, requestsPerMonth, 'compute_sp_1yr'),
      computeSP3yr: calcLmiCost(instancesWithBuffer, instanceType, requestsPerMonth, 'compute_sp_3yr'),
      ec2SP1yr: calcLmiCost(instancesWithBuffer, instanceType, requestsPerMonth, 'ec2_instance_sp'),
      reserved3yr: calcLmiCost(instancesWithBuffer, instanceType, requestsPerMonth, 'reserved_3yr'),
    },
    ec2: {
      onDemand: calcEc2Cost(instancesWithBuffer, instanceType, 'none', ec2PackingEfficiency),
      ec2SP1yr: calcEc2Cost(instancesWithBuffer, instanceType, 'ec2_instance_sp', ec2PackingEfficiency),
      reserved3yr: calcEc2Cost(instancesWithBuffer, instanceType, 'reserved_3yr', ec2PackingEfficiency),
    },
  };

  const savingsVsStd = stdCost.total_cost - lmiCost.total_cost;
  const pctVsStd = stdCost.total_cost > 0 ? (savingsVsStd / stdCost.total_cost) * 100 : 0;
  const savingsVsEc2 = ec2Cost.total_cost - lmiCost.total_cost;
  const pctVsEc2 = ec2Cost.total_cost > 0 ? (savingsVsEc2 / ec2Cost.total_cost) * 100 : 0;

  const suitability = computeSuitabilityScore(workloadType, instancesWithBuffer);

  return {
    capacity: {
      concurrency_per_vcpu: concurrencyPerVcpu,
      function_memory_mb: functionMemoryMb,
      vcpus_per_env: vcpusPerEnv,
      sustainable_concurrency_per_env: sustainableConcurrencyPerEnv,
      sustainable_concurrency_per_vcpu: sustainableConcurrencyPerVcpu,
      environments_needed: environmentsNeeded,
      envs_per_instance: envsPerInstance,
      base_instances: baseInstances,
      instances_with_buffer: instancesWithBuffer,
      scaling_buffer: SCALING_BUFFER,
      cpu_adjustment: CPU_ADJUSTMENT,
      az_config: azCfg.name,
      lmi_packing_efficiency: LMI_PACKING_EFFICIENCY,
      ec2_packing_efficiency: EC2_PACKING_EFFICIENCY,
      utilization_factor: utilizationFactor,
      lambda_cpu_usage: lambdaCpuUsage,
    },
    lmi_cost: lmiCost,
    standard_lambda_cost: stdCost,
    ec2_cost: ec2Cost,
    pricing_variants: pricingVariants,
    comparison: {
      savings_monthly_vs_std: savingsVsStd,
      savings_percent_vs_std: pctVsStd,
      is_lmi_cheaper_than_std: savingsVsStd > 0,
      savings_monthly_vs_ec2: savingsVsEc2,
      savings_percent_vs_ec2: pctVsEc2,
      is_lmi_cheaper_than_ec2: savingsVsEc2 > 0,
    },
    suitability,
  };
}