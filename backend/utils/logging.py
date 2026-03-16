"""
logging.py
Structured logging setup for the backend.
"""

import logging
import sys


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configure and return the application logger."""
    logger = logging.getLogger("campusfuel")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
