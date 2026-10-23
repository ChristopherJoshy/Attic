import unittest
from unittest import mock

import tools.profile_bundle as profile_bundle


class ProviderListTest(unittest.TestCase):
    def test_defaults_to_cpu(self):
        self.assertEqual(profile_bundle.provider_list(None), ["CPUExecutionProvider"])

    def test_parses_cuda_then_cpu(self):
        self.assertEqual(
            profile_bundle.provider_list("CUDAExecutionProvider,CPUExecutionProvider"),
            ["CUDAExecutionProvider", "CPUExecutionProvider"],
        )

    def test_preloads_runtime_libraries_for_cuda_provider(self):
        with mock.patch.object(profile_bundle.onnxruntime, "preload_dlls") as preload_dlls:
            profile_bundle.preload_provider_libraries(["CUDAExecutionProvider", "CPUExecutionProvider"])

        preload_dlls.assert_called_once_with()

    def test_does_not_preload_runtime_libraries_for_cpu_only(self):
        with mock.patch.object(profile_bundle.onnxruntime, "preload_dlls") as preload_dlls:
            profile_bundle.preload_provider_libraries(["CPUExecutionProvider"])

        preload_dlls.assert_not_called()


if __name__ == "__main__":
    unittest.main()
