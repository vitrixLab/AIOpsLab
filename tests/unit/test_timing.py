from aiopslab.timing import EvaluationTiming


def test_elapsed_uses_explicit_event_boundaries():
    timing = EvaluationTiming()
    timing.mark("fault_occurred", 10.0)
    timing.mark("detection_completed", 12.5)

    assert timing.elapsed("fault_occurred", "detection_completed") == 2.5


def test_missing_boundary_does_not_fabricate_duration():
    timing = EvaluationTiming()
    timing.mark("fault_occurred", 10.0)

    assert timing.elapsed("fault_occurred", "mitigation_completed") is None
