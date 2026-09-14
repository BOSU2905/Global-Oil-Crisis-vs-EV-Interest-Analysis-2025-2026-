"""Test package.

Present so that mypy resolves these modules as ``tests.*`` and the documented
per-module override in pyproject.toml applies. mypy's module patterns match
dotted components, not partial names, so a bare ``test_*`` pattern would not.
"""
