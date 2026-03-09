import { INSTANCE_TYPES } from '../utils/calculator';
import './MethodologyPanel.css';

function formatNumber(value) {
  return value?.toLocaleString() ?? '—';
}

function formatMoney(value) {
  return value != null ? `$${value.toFixed(2)}` : '—';
}

export default function MethodologyPanel({ results, formData }) {
  if (!results || !formData) {
    return (
      <div className="methodology-panel">
        <h2>Show calculations</h2>
        <p className="calc-placeholder">Enter your workload parameters and click Calculate to see the breakdown.</p>
      </div>
    );
  }

  const { capacity, lmi_cost, standard_lambda_cost, ec2_cost } = results;

  return (
    <div className="methodology-panel">
      <h2>Show calculations</h2>
      
      <div className="calc-steps-grid">
        <div className="calc-step">
          You need <strong>{formData.targetConcurrency}</strong> concurrent executions, each using <strong>{formData.memoryPerExec} MB</strong> of memory.
        </div>
        
        <div className="calc-step">
          Your workload is <strong>{formData.workloadType}</strong> running on <strong>{formData.runtime}</strong>.
          {capacity.lambda_cpu_usage && (
            <> Based on typical <strong>{capacity.lambda_cpu_usage}%</strong> CPU usage per invocation, you can run <strong>{capacity.sustainable_concurrency_per_vcpu}</strong> concurrent executions per vCPU.</>
          )}
        </div>
        
        <div className="calc-step">
          Each execution environment is sized at <strong>{formatNumber(capacity.function_memory_mb)} MB</strong> and can handle <strong>{capacity.sustainable_concurrency_per_env}</strong> concurrent requests.
        </div>
        
        <div className="calc-step">
          To serve {formData.targetConcurrency} concurrent executions at {capacity.sustainable_concurrency_per_env} per environment, you need <strong>{capacity.environments_needed} environments</strong>.
        </div>
        
        <div className="calc-step">
          Each <strong>{formData.instanceType}</strong> has {INSTANCE_TYPES[formData.instanceType]?.vcpus} vCPUs and {INSTANCE_TYPES[formData.instanceType]?.memory_gb} GB.
        </div>
        
        <div className="calc-step">
          After reserving 1 vCPU + 1 GB for OS, you have {INSTANCE_TYPES[formData.instanceType]?.vcpus - 1} vCPUs and {INSTANCE_TYPES[formData.instanceType]?.memory_gb - 1} GB usable.
        </div>
        
        <div className="calc-step">
          You can fit <strong>{capacity.envs_per_instance} environments per instance</strong>, so you need <strong>{capacity.instances_with_buffer || capacity.instances_needed} instances</strong> total.
        </div>
        
        <div className="calc-section-divider"></div>
        
        <div className="calc-step">
          <span className="calc-line-bold">LMI monthly cost:</span>
        </div>
        
        <div className="calc-step">
          EC2 compute: {capacity.instances_with_buffer || capacity.instances_needed} instances × {INSTANCE_TYPES[formData.instanceType]?.price_hourly.toFixed(4)}/hour × 730 hours = {formatMoney(lmi_cost.ec2_cost)}
        </div>
        
        <div className="calc-step">
          Management fee (15%): {formatMoney(lmi_cost.management_fee)}
        </div>
        
        <div className="calc-step">
          Requests ({formatNumber(formData.requestsPerMonth)}): {formatMoney(lmi_cost.request_cost)}
        </div>
        
        <div className="calc-step">
          <span className="calc-line-bold">Total LMI cost = <span className="calc-total">{formatMoney(lmi_cost.total_cost)}/month</span></span>
        </div>
        
        <div className="calc-section-divider"></div>
        
        <div className="calc-step">
          <span className="calc-line-bold">Standard Lambda monthly cost:</span>
        </div>
        
        <div className="calc-step">
          Each invocation: {formData.memoryPerExec} MB × {formData.durationSec} sec = {((formData.memoryPerExec / 1024) * formData.durationSec).toFixed(3)} GB-seconds
        </div>
        
        <div className="calc-step">
          Total compute: {formatNumber(formData.requestsPerMonth)} requests × {((formData.memoryPerExec / 1024) * formData.durationSec).toFixed(3)} GB-sec = {formatNumber(Math.round(standard_lambda_cost.gb_seconds))} GB-seconds
        </div>
        
        <div className="calc-step">
          Price per ms at {formData.memoryPerExec} MB: ${standard_lambda_cost.price_per_ms.toFixed(11)}
        </div>
        
        <div className="calc-step">
          Compute cost: {formatNumber(formData.requestsPerMonth)} requests × {formData.durationSec * 1000} ms × ${standard_lambda_cost.price_per_ms.toFixed(11)}/ms = ${formatMoney(standard_lambda_cost.compute_cost)}
        </div>
        
        <div className="calc-step">
          Request cost: {formatNumber(formData.requestsPerMonth)} requests × $0.20 per 1M = {formatMoney(standard_lambda_cost.request_cost)}
        </div>
        
        <div className="calc-step">
          <span className="calc-line-bold">Total Lambda cost = <span className="calc-total">{formatMoney(standard_lambda_cost.total_cost)}/month</span></span>
        </div>
        
        {ec2_cost && (
          <>
            <div className="calc-section-divider"></div>
            
            <div className="calc-step">
              <span className="calc-line-bold">If you managed EC2 yourself:</span>
            </div>
            
            <div className="calc-step">
              You'd need {ec2_cost.num_instances} instances ({(ec2_cost.packing_efficiency * 100).toFixed(0)}% packing efficiency vs LMI's 80%)
            </div>
            
            <div className="calc-step">
              <span className="calc-line-bold">Total EC2 cost = <span className="calc-total">{formatMoney(ec2_cost.total_cost)}/month</span></span>
            </div>
          </>
        )}
      </div>

      <div className="calc-footer">
        <p>us-east-1 • {formData.savingsPlan !== 'none' ? formData.savingsPlan : 'on-demand pricing'}</p>
      </div>
    </div>
  );
}
