import sys
import os

# Ensure worker directory is on sys.path regardless of where pytest is invoked from
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
