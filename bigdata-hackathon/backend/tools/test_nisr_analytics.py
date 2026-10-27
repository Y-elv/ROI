import unittest

import pandas as pd

from build_nisr_analytics import status_metrics, weighted_rate, weighted_status_rate


class WeightedIndicatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = pd.DataFrame({
            "rate": [100, 0, None, 100],
            "weight2": [2.0, 1.0, 10.0, 3.0],
        })

    def test_weighted_rate_uses_nonmissing_indicator_denominator(self) -> None:
        result = weighted_rate(self.fixture, "rate", "fixture valid respondents")

        self.assertEqual(result["numeratorWeighted"], 5.0)
        self.assertEqual(result["denominatorWeighted"], 6.0)
        self.assertEqual(result["value"], 83.3333)
        self.assertEqual(result["denominatorUnweighted"], 3)

    def test_weighted_status_rate_respects_requested_population(self) -> None:
        denominator = pd.Series([True, True, False, True])
        numerator = pd.Series([True, False, False, True])

        result = weighted_status_rate(
            self.fixture,
            numerator,
            denominator,
            "fixture subgroup",
        )

        self.assertEqual(result["numeratorWeighted"], 5.0)
        self.assertEqual(result["denominatorWeighted"], 6.0)
        self.assertEqual(result["value"], 83.3333)
        self.assertEqual(result["denominator"], "fixture subgroup")

    def test_status_rates_use_labor_force_and_youth_denominators(self) -> None:
        fixture = pd.DataFrame({
            "A04": [18, 20, 22, 25],
            "status1": [1, 2, 3, 1],
            "weight2": [2.0, 1.0, 2.0, 4.0],
        })

        result = status_metrics(fixture)

        self.assertEqual(result["employmentToPopulationRatio"]["value"], 66.6667)
        self.assertEqual(result["labourForceParticipationRate"]["value"], 77.7778)
        self.assertEqual(result["unemploymentRate"]["value"], 14.2857)
        self.assertEqual(result["youthEmploymentToPopulationRatio"]["value"], 40.0)
        self.assertEqual(result["youthUnemploymentRate"]["value"], 33.3333)


if __name__ == "__main__":
    unittest.main()