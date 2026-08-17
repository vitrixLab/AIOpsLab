from types import SimpleNamespace
import unittest

from aiopslab.service.kubectl import KubeCtl


def _pod(phase, ready_values=None):
    container_statuses = None
    if ready_values is not None:
        container_statuses = [
            SimpleNamespace(ready=ready) for ready in ready_values
        ]

    return SimpleNamespace(
        status=SimpleNamespace(
            phase=phase,
            container_statuses=container_statuses,
        )
    )


class PodReadinessTest(unittest.TestCase):

    def test_running_pod_with_ready_containers_satisfies_readiness(self):
        pod = _pod("Running", [True, True])

        self.assertTrue(KubeCtl._pod_is_ready_or_succeeded(pod))

    def test_succeeded_cleanup_pod_satisfies_readiness(self):
        pod = _pod("Succeeded", [False])

        self.assertTrue(KubeCtl._pod_is_ready_or_succeeded(pod))

    def test_running_pod_with_unready_container_blocks_readiness(self):
        pod = _pod("Running", [True, False])

        self.assertFalse(KubeCtl._pod_is_ready_or_succeeded(pod))

    def test_pending_pod_without_container_statuses_blocks_readiness(self):
        pod = _pod("Pending")

        self.assertFalse(KubeCtl._pod_is_ready_or_succeeded(pod))

    def test_failed_pod_with_unready_container_blocks_readiness(self):
        pod = _pod("Failed", [False])

        self.assertFalse(KubeCtl._pod_is_ready_or_succeeded(pod))
