"""Structured logging helpers for SAHAYI backend modules."""

from __future__ import annotations

import logging
import sys


def configure_logging() -> None:
    """Configure process-wide logging once.

    Args:
        None: Uses stdout logging for container and local runs.
    Returns:
        None.
    Agent:
        Platform
    """
    pass


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger for a module.

    Args:
        name: Logger namespace name.
    Returns:
        Configured logger instance.
    Agent:
        Platform
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger
