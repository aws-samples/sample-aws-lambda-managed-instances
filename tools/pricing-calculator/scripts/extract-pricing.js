#!/usr/bin/env node

/**
 * Extract Lambda and EC2 pricing from AWS Price List API JSON
 * Filters for us-east-1 region only
 */

const fs = require('fs');
const path = require('path');

// Read the full pricing JSON
const pricingPath = path.join(__dirname, '../web/src/assets/pricing.json');
const pricing = JSON.parse(fs.readFileSync(pricingPath, 'utf8'));

console.log('Parsing AWS Lambda pricing data...');
console.log(`Format version: ${pricing.formatVersion}`);
console.log(`Publication date: ${pricing.publicationDate}`);
console.log(`Total products: ${Object.keys(pricing.products).length}`);

// Extract relevant pricing
const extracted = {
  metadata: {
    source: 'AWS Price List API',
    offerCode: pricing.offerCode,
    version: pricing.version,
    publicationDate: pricing.publicationDate,
    extractedDate: new Date().toISOString(),
    region: 'us-east-1',
    regionName: 'US East (N. Virginia)'
  },
  lambda: {
    compute: {},
    requests: {},
    managedInstances: {}
  }
};

// Helper to find all price tiers for a SKU
function findPriceTiers(sku) {
  const terms = pricing.terms?.OnDemand?.[sku];
  if (!terms) return null;
  
  const termKey = Object.keys(terms)[0];
  const priceDimensions = terms[termKey]?.priceDimensions;
  if (!priceDimensions) return null;
  
  const tiers = [];
  for (const [key, dimension] of Object.entries(priceDimensions)) {
    const priceUSD = dimension.pricePerUnit?.USD;
    if (priceUSD) {
      tiers.push({
        beginRange: dimension.beginRange === 'Inf' ? Infinity : parseFloat(dimension.beginRange),
        endRange: dimension.endRange === 'Inf' ? Infinity : parseFloat(dimension.endRange),
        price: parseFloat(priceUSD),
        unit: dimension.unit,
        description: dimension.description
      });
    }
  }
  
  // Sort by beginRange
  tiers.sort((a, b) => a.beginRange - b.beginRange);
  return tiers.length > 0 ? tiers : null;
}

// Process all products
for (const [sku, product] of Object.entries(pricing.products)) {
  const attrs = product.attributes;
  
  // Only process US East (N. Virginia)
  if (attrs.location !== 'US East (N. Virginia)') continue;
  
  // Lambda compute duration (GB-seconds) - x86
  if (attrs.group === 'AWS-Lambda-Duration') {
    const tiers = findPriceTiers(sku);
    if (tiers) {
      extracted.lambda.compute.x86 = { tiers };
      console.log(`Found Lambda x86 compute tiers:`);
      tiers.forEach((tier, i) => {
        console.log(`  Tier ${i + 1}: ${tier.beginRange.toLocaleString()} - ${tier.endRange === Infinity ? 'Inf' : tier.endRange.toLocaleString()} GB-seconds @ $${tier.price}/GB-second`);
      });
    }
  }
  
  // Lambda ARM compute duration
  if (attrs.group === 'AWS-Lambda-Duration-ARM') {
    const tiers = findPriceTiers(sku);
    if (tiers) {
      extracted.lambda.compute.arm64 = { tiers };
      console.log(`Found Lambda ARM64 compute tiers:`);
      tiers.forEach((tier, i) => {
        console.log(`  Tier ${i + 1}: ${tier.beginRange.toLocaleString()} - ${tier.endRange === Infinity ? 'Inf' : tier.endRange.toLocaleString()} GB-seconds @ $${tier.price}/GB-second`);
      });
    }
  }
  
  // Lambda requests
  if (attrs.group === 'AWS-Lambda-Requests') {
    const tiers = findPriceTiers(sku);
    if (tiers && tiers.length > 0) {
      // Price is per request, convert to per million
      const pricePerRequest = tiers[0].price;
      const pricePerMillion = pricePerRequest * 1_000_000;
      extracted.lambda.requests.perMillion = pricePerMillion;
      extracted.lambda.requests.perRequest = pricePerRequest;
      console.log(`Found Lambda requests: $${pricePerMillion}/million ($${pricePerRequest}/request)`);
    }
  }
  
  // Lambda Managed Instances - extract instance types we care about
  if (attrs.lambdaManagedInstanceType) {
    const instanceType = attrs.lambdaManagedInstanceType;
    
    // Only extract c7g, m7g, r7g instances
    if (instanceType.match(/^(c7g|m7g|r7g)\./)) {
      if (!extracted.lambda.managedInstances[instanceType]) {
        extracted.lambda.managedInstances[instanceType] = {};
      }
      
      // Management fee (15% premium)
      if (attrs.usagetype?.includes('Management-Hours')) {
        const tiers = findPriceTiers(sku);
        if (tiers && tiers.length > 0) {
          extracted.lambda.managedInstances[instanceType].managementFeePerHour = tiers[0].price;
          console.log(`Found ${instanceType} management fee: $${tiers[0].price}/hour`);
        }
      }
    }
  }
}

// Add EC2 pricing note
extracted.ec2 = {
  note: "EC2 pricing should be fetched from EC2 Price List API separately",
  instances: {
    "c7g.xlarge": { vcpus: 4, memory_gb: 8, price_hourly: 0.1450 },
    "c7g.2xlarge": { vcpus: 8, memory_gb: 16, price_hourly: 0.2900 },
    "c7g.4xlarge": { vcpus: 16, memory_gb: 32, price_hourly: 0.5800 },
    "m7g.xlarge": { vcpus: 4, memory_gb: 16, price_hourly: 0.1632 },
    "m7g.2xlarge": { vcpus: 8, memory_gb: 32, price_hourly: 0.3264 },
    "m7g.4xlarge": { vcpus: 16, memory_gb: 64, price_hourly: 0.6528 },
    "r7g.xlarge": { vcpus: 4, memory_gb: 32, price_hourly: 0.2140 },
    "r7g.2xlarge": { vcpus: 8, memory_gb: 64, price_hourly: 0.4280 },
    "r7g.4xlarge": { vcpus: 16, memory_gb: 128, price_hourly: 0.8570 }
  }
};

// Write extracted pricing
const outputPath = path.join(__dirname, '../web/src/assets/pricing-extracted.json');
fs.writeFileSync(outputPath, JSON.stringify(extracted, null, 2));

console.log(`\n✓ Extracted pricing saved to: ${outputPath}`);
console.log(`  File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
console.log('\nSummary:');
console.log(`  Lambda x86 tiers: ${extracted.lambda.compute.x86?.tiers?.length || 0}`);
console.log(`  Lambda ARM64 tiers: ${extracted.lambda.compute.arm64?.tiers?.length || 0}`);
console.log(`  Lambda requests: $${extracted.lambda.requests.perMillion}/million`);
console.log(`  LMI instance types: ${Object.keys(extracted.lambda.managedInstances).length}`);
