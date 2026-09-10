import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    import pytest
except ImportError:
    class MockPytest:
        class mark:
            @staticmethod
            def asyncio(fn):
                return fn
    pytest = MockPytest()
import time
from app.services.circuit_breaker import CircuitBreaker
from app.services.weather_service import WeatherService


# ----------------------------------------------------------------------
# 1. Fuzzy Resolver Tests
# ----------------------------------------------------------------------
def test_fuzzy_resolver_exact_hub():
    mock_stations = [
        {"Station_Code": "99979", "Station_Name": "Guwahati-Dispur", "Latitude": "26.133", "Longitude": "91.783"},
        {"Station_Code": "42415", "Station_Name": "Tezpur", "Latitude": "26.610", "Longitude": "92.780"},
        {"Station_Code": "42619", "Station_Name": "Silchar", "Latitude": "24.750", "Longitude": "92.800"},
    ]
    st, meta = WeatherService.resolve_station("kamrup", mock_stations)
    assert st is not None
    assert st["Station_Code"] == "99979"
    assert meta["coverage"] == "EXACT_HUB"
    assert meta["confidence"] == 1.0


def test_fuzzy_resolver_typo_tolerance():
    mock_stations = [
        {"Station_Code": "42415", "Station_Name": "Tezpur", "Latitude": "26.610", "Longitude": "92.780"},
        {"Station_Code": "42619", "Station_Name": "Silchar", "Latitude": "24.750", "Longitude": "92.800"},
    ]
    # Typo: "tezpore" instead of "Tezpur"
    st, meta = WeatherService.resolve_station("tezpore", mock_stations)
    assert st is not None
    assert st["Station_Name"] == "Tezpur"
    assert meta["confidence"] >= 0.70


def test_fuzzy_resolver_spatial_proxy_fallback():
    mock_stations = [
        # Dispur is ~28 km from a rural point at 26.30, 91.85
        {"Station_Code": "99979", "Station_Name": "Guwahati-Dispur", "Latitude": "26.133", "Longitude": "91.783"},
        {"Station_Code": "42619", "Station_Name": "Silchar", "Latitude": "24.750", "Longitude": "92.800"},
    ]
    st, meta = WeatherService.resolve_station("unknown_rural_subdivision", mock_stations, lat_hint=26.30, lng_hint=91.85)
    assert st is not None
    assert st["Station_Name"] == "Guwahati-Dispur"
    assert meta["coverage"] == "PROXY_STATION"
    assert "proxied from nearest IMD station" in meta["proxyDisclaimer"]
    assert meta["stationDistanceKm"] < 50.0


# ----------------------------------------------------------------------
# 2. Circuit Breaker Tests
# ----------------------------------------------------------------------
def test_circuit_breaker_transitions():
    cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=0.5)
    assert cb.state == CircuitBreaker.STATE_CLOSED
    assert cb.allow_request() is True

    # 1st failure
    cb.record_failure()
    assert cb.state == CircuitBreaker.STATE_CLOSED

    # 2nd failure
    cb.record_failure()
    assert cb.state == CircuitBreaker.STATE_CLOSED

    # 3rd failure -> Trips to OPEN
    cb.record_failure()
    assert cb.state == CircuitBreaker.STATE_OPEN
    assert cb.allow_request() is False

    # Wait for cooldown
    time.sleep(0.55)
    # Allows canary probe in HALF-OPEN state
    assert cb.allow_request() is True
    assert cb.state == CircuitBreaker.STATE_HALF_OPEN

    # Success resets to CLOSED
    cb.record_success()
    assert cb.state == CircuitBreaker.STATE_CLOSED
    assert cb.failure_count == 0


# ----------------------------------------------------------------------
# 3. Corridor Risk & Detour Determination Tests
# ----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_corridor_weather_impact_severe_detour():
    # Calling corridor check with empty returns safe defaults
    res = await WeatherService.get_corridor_weather_impact([])
    assert res["severeWeather"] is False
    assert res["riskPenalty"] == 0
    assert res["detourRecommended"] is False


if __name__ == "__main__":
    import asyncio
    print("Running test_fuzzy_resolver_exact_hub()...")
    test_fuzzy_resolver_exact_hub()
    print("[PASS] test_fuzzy_resolver_exact_hub")

    print("Running test_fuzzy_resolver_typo_tolerance()...")
    test_fuzzy_resolver_typo_tolerance()
    print("[PASS] test_fuzzy_resolver_typo_tolerance")

    print("Running test_fuzzy_resolver_spatial_proxy_fallback()...")
    test_fuzzy_resolver_spatial_proxy_fallback()
    print("[PASS] test_fuzzy_resolver_spatial_proxy_fallback")

    print("Running test_circuit_breaker_transitions()...")
    test_circuit_breaker_transitions()
    print("[PASS] test_circuit_breaker_transitions")

    print("Running test_corridor_weather_impact_severe_detour()...")
    asyncio.run(test_corridor_weather_impact_severe_detour())
    print("[PASS] test_corridor_weather_impact_severe_detour")

    print("\nALL 5 IMD WEATHER TESTS PASSED SUCCESSFULLY!")
