# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

"""Event-boundary timing primitives for AIOps evaluation."""

from __future__ import annotations

import time
from typing import Dict


FAULT_OCCURRED = "fault_occurred"
DETECTION_COMPLETED = "detection_completed"
LOCALIZATION_COMPLETED = "localization_completed"
ANALYSIS_COMPLETED = "analysis_completed"
MITIGATION_COMPLETED = "mitigation_completed"


class EvaluationTiming:
    """Record benchmark lifecycle events and derive elapsed intervals."""

    def __init__(self) -> None:
        self.events: Dict[str, float] = {}

    def mark(self, event: str, timestamp: float | None = None) -> float:
        """Record an event timestamp and return the stored value."""
        value = time.time() if timestamp is None else timestamp
        self.events[event] = value
        return value

    def get(self, event: str) -> float | None:
        """Return an event timestamp, if recorded."""
        return self.events.get(event)

    def elapsed(self, start_event: str, end_event: str) -> float | None:
        """Return elapsed time between two recorded events."""
        start = self.get(start_event)
        end = self.get(end_event)
        if start is None or end is None:
            return None
        return end - start

    def to_dict(self) -> Dict[str, float]:
        """Return a JSON-serializable snapshot of recorded events."""
        return dict(self.events)
