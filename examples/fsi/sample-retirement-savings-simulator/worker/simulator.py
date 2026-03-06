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
) -> Tuple[Dict[str, float], list]:
    """
    Run Monte Carlo simulation for retirement savings.

    Uses Geometric Brownian Motion to model market returns with volatility.
    Vectorized across all scenarios for performance — processes all scenarios
    simultaneously using NumPy array operations.

    Args:
        initial_savings: Starting savings amount ($)
        monthly_contribution: Amount added each month ($)
        years_to_retirement: Number of years until retirement
        annual_return: Expected annual return (e.g., 0.07 for 7%)
        volatility: Annual volatility/standard deviation (e.g., 0.15 for 15%)
        scenarios: Number of Monte Carlo scenarios to run
        seed: Random seed for reproducibility (optional)

    Returns:
        Tuple of (statistics dict, raw final savings list):
        - statistics: {'p5', 'p50', 'p95', 'mean', 'stdDev'}
        - final_savings: list of final portfolio values for each scenario
    """
    # Use modern NumPy RNG (np.random.seed is deprecated)
    rng = np.random.default_rng(seed)

    # Convert annual parameters to monthly
    months = years_to_retirement * 12
    monthly_return = annual_return / 12
    monthly_volatility = volatility / np.sqrt(12)

    # Pre-generate all random returns: shape (scenarios, months)
    # Each element is the monthly return for one scenario in one month
    monthly_returns = rng.normal(monthly_return, monthly_volatility, size=(scenarios, months))

    # Vectorized simulation across all scenarios simultaneously
    savings = np.full(scenarios, initial_savings, dtype=np.float64)
    for month in range(months):
        savings += monthly_contribution
        savings *= (1 + monthly_returns[:, month])

    # Calculate statistics
    results = {
        'p5': float(np.percentile(savings, 5)),
        'p50': float(np.percentile(savings, 50)),
        'p95': float(np.percentile(savings, 95)),
        'mean': float(np.mean(savings)),
        'stdDev': float(np.std(savings))
    }

    return results, savings.tolist()
