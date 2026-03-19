import { useMemo, useCallback } from 'react';
import './Results.css';

function formatMoneyFull(value) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value) {
  return value.toLocaleString();
}

function exportToCsv(columns, capacity, lambdaOD) {
  const rows = [
    ['', ...columns.map(c => `${c.group} - ${c.label}`)],
    ['Compute Cost', ...columns.map(c => (c.data.compute_cost ?? c.data.ec2_after_discount ?? c.data.ec2_cost ?? 0).toFixed(2))],
    ['Mgmt Fee (15%)', ...columns.map(c => c.data.management_fee !== undefined ? c.data.management_fee.toFixed(2) : '')],
    ['Request Cost', ...columns.map(c => c.data.request_cost !== undefined ? c.data.request_cost.toFixed(2) : '')],
    ['Discount', ...columns.map(c => c.data.discount_rate ? `${(c.data.discount_rate * 100).toFixed(0)}%` : '')],
    ['Total / Month', ...columns.map(c => c.data.total_cost.toFixed(2))],
    ['vs Lambda OD', ...columns.map(c => {
      const diff = lambdaOD.total_cost - c.data.total_cost;
      const pct = lambdaOD.total_cost > 0 ? (diff / lambdaOD.total_cost) * 100 : 0;
      return Math.abs(diff) < 0.01 ? '' : `${diff > 0 ? '-' : '+'}${Math.abs(pct).toFixed(0)}%`;
    })],
    [],
    ['Capacity Metrics'],
    ['Total Instances', capacity.instances_with_buffer || capacity.instances_needed],
    ['Environments Needed', capacity.environments_needed],
    ['Environments per Instance', capacity.envs_per_instance],
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lmi-cost-comparison.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Results({ results, formData }) {
  if (!results) return null;

  const { capacity } = results;

  const tableData = useMemo(() => {
    if (!results || !formData) return null;

    const { pricing_variants } = results;
    
    const columns = [
      { group: 'Lambda',  label: 'On-Demand',     data: pricing_variants.lambda.onDemand,  key: 'lambda-od' },
      { group: 'Lambda',  label: 'Compute SP 1yr', data: pricing_variants.lambda.computeSP1yr, key: 'lambda-sp1' },
      { group: 'Lambda',  label: 'Compute SP 3yr', data: pricing_variants.lambda.computeSP3yr, key: 'lambda-sp3' },
      { group: 'LMI',     label: 'On-Demand',     data: pricing_variants.lmi.onDemand,     key: 'lmi-od' },
      { group: 'LMI',     label: 'Compute SP 1yr', data: pricing_variants.lmi.computeSP1yr,  key: 'lmi-csp1' },
      { group: 'LMI',     label: 'Compute SP 3yr', data: pricing_variants.lmi.computeSP3yr,  key: 'lmi-csp3' },
      { group: 'LMI',     label: 'EC2 SP 1yr',     data: pricing_variants.lmi.ec2SP1yr, key: 'lmi-ec2sp' },
      { group: 'LMI',     label: 'RI 3yr',         data: pricing_variants.lmi.reserved3yr,   key: 'lmi-ri3' },
      { group: 'EC2',     label: 'On-Demand',     data: pricing_variants.ec2.onDemand,     key: 'ec2-od' },
      { group: 'EC2',     label: 'EC2 SP 1yr',     data: pricing_variants.ec2.ec2SP1yr,   key: 'ec2-sp1' },
      { group: 'EC2',     label: 'RI 3yr',         data: pricing_variants.ec2.reserved3yr,   key: 'ec2-ri3' },
    ];

    const allTotals = columns.map(c => c.data.total_cost);
    const minCost = Math.min(...allTotals);

    return { columns, minCost, lambdaOD: pricing_variants.lambda.onDemand };
  }, [results, formData]);

  if (!tableData) return null;

  const { columns, minCost } = tableData;

  const groups = [
    { name: 'Standard Lambda', span: 3, cls: 'grp-lambda' },
    { name: 'Lambda Managed Instances', span: 5, cls: 'grp-lmi' },
    { name: 'Self-Managed EC2', span: 3, cls: 'grp-ec2' },
  ];

  return (
    <div className="results">
      {/* Key Metrics */}
      <div className="key-metrics">
        <h3>Key Capacity Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-card primary">
            <div className="metric-label">Total Instances</div>
            <div className="metric-value">{capacity.instances_with_buffer || capacity.instances_needed}</div>
            <div className="metric-note">
              {capacity.base_instances ? `${capacity.base_instances} base + buffer` : 'Minimum 3 for AZ resiliency'}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Environments Needed</div>
            <div className="metric-value">{capacity.environments_needed}</div>
            <div className="metric-note">Total execution environments</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Environments per Instance</div>
            <div className="metric-value">{capacity.envs_per_instance}</div>
            <div className="metric-note">Packing efficiency</div>
          </div>
        </div>
      </div>

      {/* Detailed Capacity Plan */}
      <div className="results-section">
        <h3>Detailed Capacity Plan</h3>
        <div className="capacity-grid">
          <div className="capacity-item">
            <span className="label">Concurrency per vCPU:</span>
            <span className="value">{capacity.concurrency_per_vcpu}</span>
          </div>
          <div className="capacity-item">
            <span className="label">Function Memory:</span>
            <span className="value">{formatNumber(capacity.function_memory_mb)} MB</span>
          </div>
          <div className="capacity-item">
            <span className="label">vCPUs per Environment:</span>
            <span className="value">{capacity.vcpus_per_env}</span>
          </div>
          <div className="capacity-item">
            <span className="label">Concurrent Requests per Environment:</span>
            <span className="value">{capacity.sustainable_concurrency_per_env}</span>
          </div>
          {capacity.scaling_buffer && capacity.scaling_buffer > 1 && (
            <div className="capacity-item">
              <span className="label">Scaling Buffer:</span>
              <span className="value">{capacity.scaling_buffer.toFixed(2)}x</span>
            </div>
          )}
          {capacity.az_config && (
            <div className="capacity-item">
              <span className="label">AZ Config:</span>
              <span className="value">{capacity.az_config}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cost Comparison Table */}
      <div className="results-section cost-table-section">
        <div className="section-header-row">
          <h3>Monthly Cost Comparison</h3>
          <button className="export-csv-btn" onClick={() => exportToCsv(columns, capacity, tableData.lambdaOD)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
        <div className="cost-table-wrapper">
          <table className="cost-table">
            <thead>
              <tr className="group-header-row">
                <th className="row-label-header"></th>
                {groups.map(g => (
                  <th key={g.name} colSpan={g.span} className={`group-header ${g.cls}`}>{g.name}</th>
                ))}
              </tr>
              <tr className="col-header-row">
                <th className="row-label-header"></th>
                {columns.map(col => (
                  <th key={col.key} className="col-header">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="row-label">Compute Cost</td>
                {columns.map(col => (
                  <td key={col.key} className="cell">
                    {col.data.compute_cost !== undefined
                      ? formatMoneyFull(col.data.compute_cost)
                      : formatMoneyFull(col.data.ec2_after_discount ?? col.data.ec2_cost ?? 0)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="row-label">Mgmt Fee (15%)</td>
                {columns.map(col => (
                  <td key={col.key} className="cell muted">
                    {col.data.management_fee !== undefined ? formatMoneyFull(col.data.management_fee) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="row-label">Request Cost</td>
                {columns.map(col => (
                  <td key={col.key} className="cell muted">
                    {col.data.request_cost !== undefined ? formatMoneyFull(col.data.request_cost) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="row-label">Discount</td>
                {columns.map(col => {
                  const rate = col.data.discount_rate || 0;
                  return (
                    <td key={col.key} className={`cell ${rate > 0 ? 'discount' : 'muted'}`}>
                      {rate > 0 ? `${(rate * 100).toFixed(0)}%` : '—'}
                    </td>
                  );
                })}
              </tr>
              <tr className="total-row">
                <td className="row-label">Total / Month</td>
                {columns.map(col => {
                  const isMin = Math.abs(col.data.total_cost - minCost) < 0.01;
                  return (
                    <td key={col.key} className={`cell total ${isMin ? 'best-price' : ''}`}>
                      {formatMoneyFull(col.data.total_cost)}
                      {isMin && <span className="best-badge">Lowest</span>}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="row-label">vs Lambda OD</td>
                {columns.map(col => {
                  const lambdaOD = tableData.lambdaOD.total_cost;
                  const diff = lambdaOD - col.data.total_cost;
                  const pct = lambdaOD > 0 ? (diff / lambdaOD) * 100 : 0;
                  return (
                    <td key={col.key} className={`cell ${diff > 0 ? 'savings-cell' : diff < 0 ? 'loss-cell' : 'muted'}`}>
                      {Math.abs(diff) < 0.01 ? '—' : `${diff > 0 ? '↓' : '↑'} ${Math.abs(pct).toFixed(0)}%`}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="table-footnotes">
          <span>{capacity.instances_with_buffer || capacity.instances_needed} LMI instances @ {(capacity.lmi_packing_efficiency * 100).toFixed(0)}% packing</span>
          <span className="sep">•</span>
          <span>EC2: {tableData.columns.find(c => c.key === 'ec2-od')?.data.num_instances || 'N/A'} instances @ {((tableData.columns.find(c => c.key === 'ec2-od')?.data.packing_efficiency || 0.6) * 100).toFixed(0)}% packing</span>
          <span className="sep">•</span>
          <span>Lambda SP discount applies to compute only</span>
        </div>
      </div>
    </div>
  );
}
