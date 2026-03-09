import { useState } from 'react';
import {
  RUNTIME_LIMITS, INSTANCE_TYPES, SAVINGS_PLANS,
  WORKLOAD_TYPES, TRAFFIC_PATTERNS, PERFORMANCE_PROFILES, AZ_CONFIGS,
} from '../utils/calculator';
import './CalculatorForm.css';

export default function CalculatorForm({ onCalculate }) {
  const [formData, setFormData] = useState({
    runtime: 'python',
    targetConcurrency: 100,
    memoryPerExec: 500,
    memVcpuRatio: 2,
    instanceType: 'c7g.xlarge',
    requestsPerMonth: 10000000,
    durationSec: 60,
    arch: 'arm64',
    savingsPlan: 'none',
    workloadType: 'balanced',
    azConfig: '3az',
    maxConcurrencyOverride: '',
    functionMemoryOverride: '',
    envsPerInstanceOverride: '',
    ec2PackingEfficiency: '',
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="calculator-form">
      <div className="form-header">
        <h2>LMI Cost Calculator</h2>
      </div>

      {/* Row 1: Core workload params — the essentials */}
      <div className="form-section">
        <h3>Workload</h3>
        <div className="form-row cols-3">
          <div className="form-group">
            <label htmlFor="runtime">Runtime</label>
            <select id="runtime" name="runtime" value={formData.runtime} onChange={handleChange}>
              {Object.keys(RUNTIME_LIMITS).map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)} (max concurrency {RUNTIME_LIMITS[r]}/vCPU)</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="targetConcurrency">Target Concurrency</label>
            <input type="number" id="targetConcurrency" name="targetConcurrency"
              value={formData.targetConcurrency} onChange={handleChange} min="1" required />
          </div>
          <div className="form-group">
            <label htmlFor="memoryPerExec">Memory / Exec (MB)</label>
            <input type="number" id="memoryPerExec" name="memoryPerExec"
              value={formData.memoryPerExec} onChange={handleChange} min="1" required />
          </div>
        </div>
        <div className="form-row cols-3">
          <div className="form-group">
            <label htmlFor="requestsPerMonth">Monthly Requests</label>
            <input type="number" id="requestsPerMonth" name="requestsPerMonth"
              value={formData.requestsPerMonth} onChange={handleChange} min="1" required />
          </div>
          <div className="form-group">
            <label htmlFor="durationSec">Avg Duration (sec)</label>
            <input type="number" id="durationSec" name="durationSec"
              value={formData.durationSec} onChange={handleChange} min="0.1" step="0.1" required />
          </div>
          <div className="form-group">
            <label htmlFor="arch">Architecture</label>
            <select id="arch" name="arch" value={formData.arch} onChange={handleChange}>
              <option value="arm64">ARM64 (Graviton)</option>
              <option value="x86_64">x86_64</option>
            </select>
          </div>
        </div>
      </div>

      {/* Row 2: Workload characterization — Zach's new dimensions */}
      <div className="form-section">
        <h3>Workload Profile</h3>
        <div className="form-row cols-2">
          <div className="form-group">
            <label htmlFor="workloadType">Workload Type</label>
            <select id="workloadType" name="workloadType" value={formData.workloadType} onChange={handleChange}>
              {Object.entries(WORKLOAD_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="azConfig">AZ Resilience</label>
            <select id="azConfig" name="azConfig" value={formData.azConfig} onChange={handleChange}>
              {Object.entries(AZ_CONFIGS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Row 3: Instance & pricing config */}
      <div className="form-section">
        <h3>LMI Configuration</h3>
        <div className="form-row cols-2">
          <div className="form-group">
            <label htmlFor="instanceType">Instance Type</label>
            <select id="instanceType" name="instanceType" value={formData.instanceType} onChange={handleChange}>
              {Object.entries(INSTANCE_TYPES).map(([type, s]) => (
                <option key={type} value={type}>
                  {type} — {s.vcpus}vCPU, {s.memory_gb}GB, ${s.price_hourly.toFixed(4)}/hr
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="memVcpuRatio">Memory-to-vCPU Ratio</label>
            <select id="memVcpuRatio" name="memVcpuRatio" value={formData.memVcpuRatio} onChange={handleChange}>
              <option value="2">2:1 — Compute optimized</option>
              <option value="4">4:1 — Balanced</option>
              <option value="8">8:1 — Memory optimized</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advanced overrides — collapsed by default */}
      <div className="form-section advanced-section">
        <div className="advanced-header" onClick={() => setShowAdvanced(!showAdvanced)}>
          <h3>Advanced Overrides</h3>
          <svg className={`toggle-icon ${showAdvanced ? 'open' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        {showAdvanced && (
          <div className="advanced-content">
            <p className="advanced-description">Leave empty to use auto-calculated values.</p>
            <div className="form-row cols-4">
              <div className="form-group">
                <label htmlFor="maxConcurrencyOverride">Max Concurrency/vCPU</label>
                <input type="number" id="maxConcurrencyOverride" name="maxConcurrencyOverride"
                  value={formData.maxConcurrencyOverride} onChange={handleChange}
                  min="1" max="1000" placeholder="Auto" />
              </div>
              <div className="form-group">
                <label htmlFor="functionMemoryOverride">Function Memory (MB)</label>
                <input type="number" id="functionMemoryOverride" name="functionMemoryOverride"
                  value={formData.functionMemoryOverride} onChange={handleChange}
                  min="2048" max="65536" step="128" placeholder="Auto (min 2048)" />
              </div>
              <div className="form-group">
                <label htmlFor="envsPerInstanceOverride">Envs / Instance</label>
                <input type="number" id="envsPerInstanceOverride" name="envsPerInstanceOverride"
                  value={formData.envsPerInstanceOverride} onChange={handleChange}
                  min="1" max="100" placeholder="Auto" />
              </div>
              <div className="form-group">
                <label htmlFor="ec2PackingEfficiency">EC2 Packing (%)</label>
                <input type="number" id="ec2PackingEfficiency" name="ec2PackingEfficiency"
                  value={formData.ec2PackingEfficiency} onChange={handleChange}
                  min="1" max="100" step="1" placeholder="60" />
              </div>
            </div>
          </div>
        )}
      </div>

      <button type="submit" className="calculate-btn">
        Calculate
      </button>
    </form>
  );
}