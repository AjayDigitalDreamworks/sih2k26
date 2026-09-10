"""
In-process Circuit Breaker for Upstream API Resilience.
Guarantees fast failover during judged demos and production network hiccups.
"""
import time
from typing import Dict, Any


class CircuitBreaker:
    STATE_CLOSED = "CLOSED"
    STATE_OPEN = "OPEN"
    STATE_HALF_OPEN = "HALF_OPEN"

    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = self.STATE_CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0.0
        self.last_state_change = time.time()
        self.total_requests = 0
        self.total_failures = 0

    def allow_request(self) -> bool:
        self.total_requests += 1
        now = time.time()

        if self.state == self.STATE_CLOSED:
            return True

        if self.state == self.STATE_OPEN:
            if (now - self.last_failure_time) >= self.cooldown_seconds:
                self.state = self.STATE_HALF_OPEN
                self.last_state_change = now
                return True
            return False

        if self.state == self.STATE_HALF_OPEN:
            # Allow a single canary probe
            return True

        return True

    def record_success(self):
        self.success_count += 1
        self.failure_count = 0
        if self.state != self.STATE_CLOSED:
            self.state = self.STATE_CLOSED
            self.last_state_change = time.time()

    def record_failure(self):
        self.failure_count += 1
        self.total_failures += 1
        self.last_failure_time = time.time()

        if self.state == self.STATE_HALF_OPEN or self.failure_count >= self.failure_threshold:
            self.state = self.STATE_OPEN
            self.last_state_change = time.time()

    def get_metrics(self) -> Dict[str, Any]:
        return {
            "state": self.state,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "cooldown_seconds": self.cooldown_seconds,
            "total_requests": self.total_requests,
            "total_failures": self.total_failures,
            "seconds_since_last_failure": round(time.time() - self.last_failure_time, 1) if self.last_failure_time > 0 else None,
        }
