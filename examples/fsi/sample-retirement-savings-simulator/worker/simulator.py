"""
Monte Carlo Retirement Savings Simulator

This module implements a simplified Geometric Brownian Motion (GBM) model
for simulating retirement savings outcomes under market uncertainty.

Educational purpose: Demonstrate sustained CPU-intensive compute on LMI.
"""

import numpy as np
from typing import Dict, Tuple


def simulate_retirement_savings(
    initial_savings: float,
    monthly_contribution: float,
    years_to_retirement: int,
    annual_return: float,
    volatility: float,
    scenarios: int,
    seed: int = None
) -> Dict[str, float]:
    """
    Run Monte Carlo simulation for retirement savings.
    
    Uses Geometric Brownian Motion to model market returns with volatility.
    Each scenario simulates monthly compounding over the retirement period.
    
    Args:
        initial_savings: Starting savings amount ($)
        monthly_contribution: Amount added each month ($)
        years_to_retirement: Number of years until retirement
        annual_return: Expected annual return (e.g., 0.07 for 7%)
        volatility: Annual volatility/standard deviation (e.g., 0.15 for 15%)
        scenarios: Number of Monte Carlo scenarios to run
        seed: Random seed for reproducibility (optional)
    
    Returns:
        Dictionary with percentiles and statistics:
        {
            'p5': 5th percentile final savings,
            'p50': Median final savings,
            'p95': 95th percentile final savings,
            'mean': Average final savings,
            'stdDev': Standard deviation of final savings
        }
    """
    # Set random seed for deterministic results
    if seed is not None:
        np.random.seed(seed)
    
    # Convert annual parameters to monthly
    months = years_to_retirement * 12
    monthly_return = annual_return / 12
    monthly_volatility = volatility / np.sqrt(12)
    
    # Initialize array to store final savings for each scenario
    final_savings = np.zeros(scenarios)
    
    # Run Monte Carlo simulation
    for scenario_idx in range(scenarios):
        savings = initial_savings
        
        # Simulate each month
        for month in range(months):
            # Add monthly contribution
            savings += monthly_contribution
            
            # Apply stochastic return using Geometric Brownian Motion
            # Formula: return = drift + volatility * random_shock
            random_shock = np.random.normal(0, 1)
            monthly_actual_return = monthly_return + (monthly_volatility * random_shock)
            
            # Update savings with return
            savings *= (1 + monthly_actual_return)
        
        # Store final savings for this scenario
        final_savings[scenario_idx] = savings
    
    # Calculate statistics
    results = {
        'p5': float(np.percentile(final_savings, 5)),
        'p50': float(np.percentile(final_savings, 50)),
        'p95': float(np.percentile(final_savings, 95)),
        'mean': float(np.mean(final_savings)),
        'stdDev': float(np.std(final_savings))
    }
    
    return results


def calculate_percentiles(values: np.ndarray, percentiles: list = [5, 50, 95]) -> Dict[str, float]:
    """
    Calculate percentiles from an array of values.
    
    Args:
        values: NumPy array of values
        percentiles: List of percentile values to calculate (default: [5, 50, 95])
    
    Returns:
        Dictionary mapping percentile names to values
    """
    result = {}
    for p in percentiles:
        key = f'p{p}'
        result[key] = float(np.percentile(values, p))
    return result


def validate_config(config: Dict) -> Tuple[bool, str]:
    """
    Validate retirement simulation configuration.
    
    Args:
        config: Configuration dictionary
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    required_fields = [
        'initialSavings', 'monthlyContribution', 'yearsToRetirement',
        'annualReturn', 'volatility', 'totalScenarios', 'shards'
    ]
    
    # Check required fields
    for field in required_fields:
        if field not in config:
            return False, f"Missing required field: {field}"
    
    # Validate ranges
    if config['initialSavings'] < 0:
        return False, "initialSavings must be >= 0"
    
    if config['monthlyContribution'] < 0:
        return False, "monthlyContribution must be >= 0"
    
    if not (1 <= config['yearsToRetirement'] <= 50):
        return False, "yearsToRetirement must be between 1 and 50"
    
    if not (-0.5 <= config['annualReturn'] <= 0.5):
        return False, "annualReturn must be between -0.5 and 0.5"
    
    if not (0 <= config['volatility'] <= 1):
        return False, "volatility must be between 0 and 1"
    
    if not (10000 <= config['totalScenarios'] <= 10000000):
        return False, "totalScenarios must be between 10,000 and 10,000,000"
    
    if not (1 <= config['shards'] <= 100):
        return False, "shards must be between 1 and 100"
    
    return True, ""
