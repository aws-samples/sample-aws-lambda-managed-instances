import { useMemo } from 'react';
import { calcLmiCost, calcStandardLambdaCost, calcEc2Cost } from '../utils/calculator';
import './CostComparisonChart.css';

function formatMoney(value) {
  return `$${value.toFixed(0)}`;
}

function formatMoneyCompact(value) {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export default function CostComparisonChart({ results, formData }) {
  const chartData = useMemo(() => {
    if (!results || !formData) return null;

    const { capacity } = results;
    
    // Use the original form parameters
    const instanceType = formData.instanceType || 'c7g.xlarge';
    const durationSec = formData.durationSec || 60;
    const memoryPerExec = formData.memoryPerExec;
    const arch = formData.arch || 'arm64';
    const instanceCount = capacity.instances_with_buffer || capacity.instances_needed;
    
    // Volume scenarios
    const volumes = [
      { label: 'Low', requests: 1_000_000, displayRequests: '1M', xPosition: 0 },
      { label: 'Medium', requests: 10_000_000, displayRequests: '10M', xPosition: 1 },
      { label: 'High', requests: 50_000_000, displayRequests: '50M', xPosition: 2 },
      { label: 'Very High', requests: 100_000_000, displayRequests: '100M', xPosition: 3 }
    ];

    // Savings plan scenarios
    const savingsPlans = [
      { key: 'none', label: 'Standard Lambda', color: '#2E86AB', strokeWidth: 3 },
      { key: 'ec2_managed', label: 'Customer EC2', color: '#10B981', strokeWidth: 2 },
      { key: 'lmi_ondemand', label: 'LMI On-demand', color: '#F18F01', strokeWidth: 2 },
      { key: 'compute_sp', label: 'LMI - 1 YR Compute', color: '#C73E1D', strokeWidth: 2 },
      { key: 'ec2_instance_sp', label: 'LMI 1 YR EC2 Savings', color: '#0EA5E9', strokeWidth: 2 },
      { key: 'reserved_3yr', label: 'LMI 3 YR RI', color: '#7C3AED', strokeWidth: 2 }
    ];

    // Calculate costs for each volume and plan combination
    const data = volumes.map(volume => {
      const costs = {};
      
      // Standard Lambda cost (with compute savings plan)
      costs['none'] = calcStandardLambdaCost(
        volume.requests, 
        durationSec, 
        memoryPerExec, 
        arch, 
        'compute_sp_1yr' // Use compute savings plan for Lambda
      ).total_cost;
      
      // Self-managed EC2 cost (with EC2 Instance SP)
      costs['ec2_managed'] = calcEc2Cost(
        instanceCount,
        instanceType,
        'ec2_instance_sp' // Use EC2 Instance SP for customer EC2
      ).total_cost;
      
      // LMI costs with different savings plans
      costs['lmi_ondemand'] = calcLmiCost(
        instanceCount, 
        instanceType, 
        volume.requests, 
        'none' // No savings plan - should be most expensive LMI option
      ).total_cost;
      
      costs['compute_sp'] = calcLmiCost(
        instanceCount, 
        instanceType, 
        volume.requests, 
        'compute_sp_1yr'
      ).total_cost;
      
      costs['ec2_instance_sp'] = calcLmiCost(
        instanceCount, 
        instanceType, 
        volume.requests, 
        'ec2_instance_sp'
      ).total_cost;
      
      costs['reserved_3yr'] = calcLmiCost(
        instanceCount, 
        instanceType, 
        volume.requests, 
        'reserved_3yr'
      ).total_cost;

      return {
        ...volume,
        costs
      };
    });

    // Find max cost for scaling
    const maxCost = Math.max(
      ...data.flatMap(d => Object.values(d.costs))
    );
    
    // Calculate Y-axis scale with 5K intervals (keep original logic)
    const yAxisInterval = 5000;
    const yAxisMax = Math.ceil(maxCost / yAxisInterval) * yAxisInterval;
    const yAxisSteps = Math.ceil(yAxisMax / yAxisInterval);
    
    // Calculate dynamic chart height based on number of steps
    const minHeight = 300;
    const heightPerStep = 25; // 25px per Y-axis step
    const dynamicHeight = Math.max(minHeight, 200 + (yAxisSteps * heightPerStep));
    
    // Debug logging to verify scaling
    console.log('Chart scaling:', {
      maxCost: maxCost.toFixed(0),
      yAxisInterval: yAxisInterval,
      yAxisMax: yAxisMax,
      yAxisSteps: yAxisSteps,
      dynamicHeight: dynamicHeight
    });

    return { 
      data, 
      savingsPlans, 
      maxCost,
      yAxisMax,
      yAxisInterval,
      yAxisSteps,
      dynamicHeight,
      instanceType, 
      memoryPerExec 
    };
  }, [results, formData]);

  if (!chartData) return null;

  const { data, savingsPlans, maxCost, yAxisMax, yAxisInterval, yAxisSteps, dynamicHeight, instanceType, memoryPerExec } = chartData;

  return (
    <div className="cost-comparison-chart">
      <h3>
        <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18M8 17l4-4 4 4 4-4"/>
        </svg>
        Cost Comparison by Volume
      </h3>
      
      <div className="chart-container" style={{ height: `${dynamicHeight}px` }}>
        <div className="chart-content">
          <svg className="line-chart" viewBox={`0 0 350 ${dynamicHeight - 80}`} preserveAspectRatio="xMidYMid meet">
            {/* Y-axis label inside SVG */}
            <text
              x="-45"
              y={(dynamicHeight - 80) / 2}
              textAnchor="middle"
              fontSize="14"
              fill="#666"
              fontWeight="500"
              transform={`rotate(-90, -45, ${(dynamicHeight - 80) / 2})`}
            >
              Monthly Cost
            </text>
            
            {/* Y-axis values inside SVG */}
            {Array.from({ length: yAxisSteps + 1 }, (_, i) => {
              const value = i * yAxisInterval;
              const yPosition = (dynamicHeight - 130) - ((value / yAxisMax) * (dynamicHeight - 180));
              
              return (
                <text
                  key={value}
                  x="-5"
                  y={yPosition + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#666"
                >
                  {value === 0 ? '$0' : `$${value / 1000}K`}
                </text>
              );
            })}
            
            {/* Y-axis line */}
            <line
              x1="0"
              y1="50"
              x2="0"
              y2={dynamicHeight - 130}
              stroke="#9ca3af"
              strokeWidth="2"
            />
            
            {/* X-axis line */}
            <line
              x1="0"
              y1={dynamicHeight - 130}
              x2="330"
              y2={dynamicHeight - 130}
              stroke="#9ca3af"
              strokeWidth="2"
            />
            
            {/* Grid lines */}
            {Array.from({ length: yAxisSteps }, (_, i) => {
              const value = (i + 1) * yAxisInterval;
              const yPosition = (dynamicHeight - 130) - ((value / yAxisMax) * (dynamicHeight - 180));
              return (
                <line
                  key={value}
                  x1="0"
                  y1={yPosition}
                  x2="330"
                  y2={yPosition}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              );
            })}
            
            {/* Y-axis tick marks */}
            {Array.from({ length: yAxisSteps + 1 }, (_, i) => {
              const value = i * yAxisInterval;
              const yPosition = (dynamicHeight - 130) - ((value / yAxisMax) * (dynamicHeight - 180));
              return (
                <line
                  key={value}
                  x1="-3"
                  y1={yPosition}
                  x2="3"
                  y2={yPosition}
                  stroke="#9ca3af"
                  strokeWidth="1"
                />
              );
            })}
            
            {/* X-axis tick marks */}
            {data.map((volume, index) => (
              <line
                key={volume.label}
                x1={15 + (index * 105)}
                y1={dynamicHeight - 130}
                x2={15 + (index * 105)}
                y2={dynamicHeight - 125}
                stroke="#9ca3af"
                strokeWidth="1"
              />
            ))}
            
            {/* X-axis labels */}
            {data.map((volume, index) => (
              <g key={volume.label}>
                <text
                  x={15 + (index * 105)}
                  y={dynamicHeight - 105}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#666"
                >
                  {volume.label} ({volume.displayRequests})
                </text>
              </g>
            ))}
            
            {/* Lines and points for each savings plan */}
            {savingsPlans.map(plan => {
              const points = data.map((volume, index) => {
                const cost = volume.costs[plan.key];
                const x = 15 + (index * 105);
                const y = (dynamicHeight - 130) - ((cost / yAxisMax) * (dynamicHeight - 180));
                return { x, y, cost };
              });
              
              // Create path string for the line
              const pathData = points.map((point, index) => 
                `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
              ).join(' ');
              
              return (
                <g key={plan.key}>
                  {/* Line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={plan.color}
                    strokeWidth={plan.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Points */}
                  {points.map((point, index) => (
                    <circle
                      key={index}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill={plan.color}
                      stroke="white"
                      strokeWidth="2"
                    >
                      <title>{`${plan.label}: ${formatMoney(point.cost)}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      
      <div className="chart-legend">
        {savingsPlans.map(plan => (
          <div key={plan.key} className="legend-item">
            <div 
              className="legend-color" 
              style={{ backgroundColor: plan.color }}
            ></div>
            <span className="legend-label">{plan.label}</span>
          </div>
        ))}
      </div>
      
      <div className="chart-note">
        <p>
          <strong>Note:</strong> Chart shows costs across different request volumes (1M to 100M requests/month) using your current configuration 
          ({results.capacity.instances_with_buffer || results.capacity.instances_needed} instances, {instanceType}, {results.capacity.function_memory_mb}MB function memory, {memoryPerExec}MB per execution).
          Standard Lambda includes 17% Compute Savings Plan discount. Customer EC2 assumes 60% packing efficiency vs LMI's 80%.
        </p>
      </div>
    </div>
  );
}