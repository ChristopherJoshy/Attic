#!/usr/bin/env python3
"""
Nexus Wars Local Testing CLI

Entry point for running local matches and tournaments.
"""

import sys
import os

# Add the project root to path so nexus_wars can be imported as a package
sys.path.insert(0, os.path.dirname(__file__))

from nexus_wars.run_match import _main

if __name__ == "__main__":
    _main(sys.argv[1:])