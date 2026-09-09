import asyncio
from app.engine.micro_segment_engine import (
    haversine_distance_km,
    slice_polyline_into_500m_chunks,
    predict_batch_microsegments,
    score_route_microsegments,
)


def test_haversine_distance():
    # Distance between Guwahati (26.1445, 91.7362) and Shillong (25.5788, 91.8933) is ~64 km
    d = haversine_distance_km(26.1445, 91.7362, 25.5788, 91.8933)
    assert 60 < d < 70


def test_slice_polyline_into_500m_chunks():
    # Create a 2.5 km line with 5 segments of 500m
    # 0.0045 deg lat is approx 500m
    points = [
        [26.0, 91.0],
        [26.0045, 91.0],
        [26.0090, 91.0],
        [26.0135, 91.0],
        [26.0180, 91.0],
        [26.0225, 91.0],
    ]
    chunks = slice_polyline_into_500m_chunks(points, target_chunk_km=0.5)
    assert len(chunks) >= 4
    for c in chunks:
        assert "segment_index" in c
        assert "start_chainage_km" in c
        assert "end_chainage_km" in c
        assert "coordinates" in c
        assert len(c["coordinates"]) >= 2
        assert "tortuosity" in c


def test_predict_batch_microsegments():
    features = [
        {"segment_index": 0, "start_chainage_km": 0.0, "end_chainage_km": 0.5, "slope_risk": 15, "rainfall_24h_mm": 5, "road_condition": "good"},
        {"segment_index": 1, "start_chainage_km": 0.5, "end_chainage_km": 1.0, "slope_risk": 85, "rainfall_24h_mm": 65, "road_condition": "blocked", "hazard_reason": "KM 1 Landslide"},
    ]
    results = predict_batch_microsegments(features)
    assert len(results) == 2
    # First chunk should be low/medium risk
    assert results[0]["risk_score"] < 50
    assert results[0]["risk_level"] in ("low", "medium")

    # Second chunk has blocked road + heavy rain + steep slope -> must be critical/high
    assert results[1]["risk_score"] > 65
    assert results[1]["risk_level"] in ("high", "critical")
    assert results[1]["hazard_reason"] == "KM 1 Landslide"


async def test_score_route_microsegments():
    points = [
        [26.1445, 91.7362],
        [26.1600, 91.7500],
        [26.1800, 91.7700],
    ]
    scored = await score_route_microsegments(points, route_id="test_route")
    assert len(scored) > 0
    for chunk in scored:
        assert "risk_score" in chunk
        assert "risk_level" in chunk
        assert "slope_pct" in chunk
        assert "elevation_start_m" in chunk
