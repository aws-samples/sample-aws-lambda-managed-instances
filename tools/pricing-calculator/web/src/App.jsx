import { useState } from 'react'
import CalculatorForm from './components/CalculatorForm'
import Results from './components/Results'
import MethodologyPanel from './components/MethodologyPanel'
import { calculateLmi } from './utils/calculator'
import awsLogo from './assets/aws-logo.svg'
import lambdaIcon from './assets/lambda-icon.svg'
import './App.css'

function Assumptions() {
  const [open, setOpen] = useState(false)
  return (
    <div className={`assumptions-panel ${open ? 'is-open' : ''}`}>
      <button className="assumptions-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="assumptions-toggle-left">
          Key Assumptions &amp; Methodology
        </span>
        <span className="assumptions-hint">{open ? '' : 'Click to expand'}</span>
        <svg className={`chevron ${open ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="assumptions-body">
          <div className="assumptions-grid">
            <div className="assumption-card">
              <div className="assumption-card-header">
                <span className="assumption-dot" style={{background:'#ec7211'}}></span>
                <h4>Pricing</h4>
              </div>
              <table className="assumption-table">
                <tbody>
                  <tr><td>Region</td><td>us-east-1</td></tr>
                  <tr><td>Lambda Pricing</td><td><a href="https://aws.amazon.com/lambda/pricing/" target="_blank" rel="noopener noreferrer">View pricing</a></td></tr>
                  <tr><td>Requests</td><td>$0.20 per 1M</td></tr>
                  <tr><td>LMI Mgmt Fee</td><td>15% of OD EC2</td></tr>
                  <tr><td>Hours/Month</td><td>730</td></tr>
                </tbody>
              </table>
            </div>
            <div className="assumption-card">
              <div className="assumption-card-header">
                <span className="assumption-dot" style={{background:'#0073bb'}}></span>
                <h4>Savings Plans &amp; RIs</h4>
              </div>
              <table className="assumption-table">
                <tbody>
                  <tr><td>Compute SP 1yr</td><td>32% EC2 · 12% Lambda</td></tr>
                  <tr><td>Compute SP 3yr</td><td>65% EC2 · 12% Lambda</td></tr>
                  <tr><td>EC2 Instance SP</td><td>32% EC2 only</td></tr>
                  <tr><td>Reserved 3yr</td><td>65% EC2 only</td></tr>
                  <tr><td colSpan="2" className="assumption-note">SP discount on compute only, not requests</td></tr>
                </tbody>
              </table>
            </div>
            <div className="assumption-card">
              <div className="assumption-card-header">
                <span className="assumption-dot" style={{background:'#1d8102'}}></span>
                <h4>Capacity &amp; Packing</h4>
              </div>
              <table className="assumption-table">
                <tbody>
                  <tr><td>LMI Packing</td><td>80%</td></tr>
                  <tr><td>EC2 Packing</td><td>60%</td></tr>
                  <tr><td>OS Overhead</td><td>1 vCPU + 1 GB</td></tr>
                  <tr><td>Min Memory</td><td>2,048 MB</td></tr>
                  <tr><td>AZ Buffer</td><td>1.5× (3-AZ) · 1.25× (5-AZ)</td></tr>
                </tbody>
              </table>
            </div>
            <div className="assumption-card">
              <div className="assumption-card-header">
                <span className="assumption-dot" style={{background:'#232f3e'}}></span>
                <h4>Workload Profiles</h4>
              </div>
              <table className="assumption-table">
                <tbody>
                  <tr><td>IO-Heavy (Proxy/Queue)</td><td>8 concurrent per vCPU (12.5% CPU each)</td></tr>
                  <tr><td>Balanced (Mixed)</td><td>4 concurrent per vCPU (25% CPU each)</td></tr>
                  <tr><td>CPU-Heavy (Compute)</td><td>2 concurrent per vCPU (50% CPU each)</td></tr>
                  <tr><td colSpan="2" className="assumption-note">Based on typical performance requirements. If your workload consumes even lower CPU, you might be able to achieve better performance and leverage more concurrency.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <p className="assumptions-source">
            Savings plan rates from internal Elevator analysis · EC2 pricing validated against{' '}
            <a href="https://aws.amazon.com/ec2/pricing/on-demand/" target="_blank" rel="noopener noreferrer">official AWS pricing</a>
            {' '}· All estimates approximate · Costs calculated for steady-state workloads; fluctuating traffic patterns may result in different costs
          </p>
        </div>
      )}
    </div>
  )
}

function App() {
  const [results, setResults] = useState(null)
  const [formData, setFormData] = useState(null)
  const [error, setError] = useState(null)

  const handleCalculate = (formData) => {
    try {
      setError(null)
      const calculationResults = calculateLmi(formData)
      setResults(calculationResults)
      setFormData(formData) // Store the form data
    } catch (err) {
      setError(err.message)
      setResults(null)
      setFormData(null)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logos">
          <img src={awsLogo} alt="AWS" className="aws-logo" />
          <img src={lambdaIcon} alt="Lambda" className="lambda-icon" />
        </div>
        <h1>AWS Lambda Managed Instances</h1>
        <h2>Cost & Capacity Calculator</h2>
        <p>Compare LMI vs Standard Lambda pricing and plan your capacity</p>
      </header>

      <main className="app-main">
        <div className="calculator-container">
          <Assumptions />
          <CalculatorForm onCalculate={handleCalculate} />
          
          {error && (
            <div className="error-message">
              <div className="error-content">
                <h3>Configuration Error</h3>
                <p>{error}</p>
              </div>
            </div>
          )}
          
          <Results results={results} formData={formData} />
          
          <MethodologyPanel results={results} formData={formData} />
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <img src={awsLogo} alt="AWS" className="footer-logo" />
          <div className="footer-text">
            <p>
              Based on <a href="https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html" target="_blank" rel="noopener noreferrer">
                AWS Lambda Managed Instances Documentation
              </a>
            </p>
            <p>Pricing data for us-east-1 region. Actual costs may vary.</p>
          </div>
          <a
            className="feedback-btn"
            href="https://github.com/aws-samples/sample-aws-lambda-managed-instances/issues/new?labels=feedback&template=feedback.md&title=%5BFeedback%5D+"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Send Feedback
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
