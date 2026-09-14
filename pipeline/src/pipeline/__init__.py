"""Reproducible analytical pipeline for the Oil vs EV interest analysis.

Layer boundary (see METHODOLOGY.md):

    data/raw  ->  ingest  ->  transform  ->  metrics  ->  emit  ->  JSON artifacts

Every number that will ever be displayed by the frontend originates in this
package and is written to a generated JSON artifact. The presentation layer
never computes a statistic.
"""

__version__ = "1.0.0"
