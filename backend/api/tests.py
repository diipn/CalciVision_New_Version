import unittest
import numpy as np

from api.utils import aggregate_objective_variable_metrics, quantify_objective_variable


class ObjectiveVariableUtilsTests(unittest.TestCase):
    def test_quantify_objective_variable_counts_uniform_white_roi(self):
        image = np.full((16, 16), 240, dtype=np.uint8)

        metrics = quantify_objective_variable(
            image,
            {'x': 0, 'y': 0, 'width': 16, 'height': 16},
        )

        self.assertIsNotNone(metrics)
        self.assertEqual(metrics['white_pixel_count'], 256)
        self.assertEqual(metrics['gray_pixel_count'], 0)
        self.assertEqual(metrics['valid_pixel_count'], 256)
        self.assertEqual(metrics['vo'], 1.0)

    def test_quantify_objective_variable_counts_uniform_gray_roi(self):
        image = np.full((10, 10), 160, dtype=np.uint8)

        metrics = quantify_objective_variable(
            image,
            {'x': 0, 'y': 0, 'width': 10, 'height': 10},
        )

        self.assertIsNotNone(metrics)
        self.assertEqual(metrics['white_pixel_count'], 0)
        self.assertEqual(metrics['gray_pixel_count'], 100)
        self.assertEqual(metrics['valid_pixel_count'], 100)
        self.assertEqual(metrics['vo'], 0.5)

    def test_aggregate_objective_variable_metrics_is_weighted_by_pixel_count(self):
        summary = aggregate_objective_variable_metrics([
            {
                'white_pixel_count': 40,
                'gray_pixel_count': 20,
                'valid_pixel_count': 100,
            },
            {
                'white_pixel_count': 10,
                'gray_pixel_count': 30,
                'valid_pixel_count': 50,
            },
        ])

        self.assertIsNotNone(summary)
        self.assertAlmostEqual(summary['vo'], 0.5, places=6)
        self.assertEqual(summary['white_pixel_count'], 50)
        self.assertEqual(summary['gray_pixel_count'], 50)
        self.assertEqual(summary['valid_pixel_count'], 150)
        self.assertEqual(summary['frame_count'], 2)
