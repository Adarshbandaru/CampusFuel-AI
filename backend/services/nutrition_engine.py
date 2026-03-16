"""
nutrition_engine.py
Macro calculations and food recommendations.
"""

from typing import List


PROTEIN_FOODS = [
    {"name": "Paneer (100g)", "protein_g": 18},
    {"name": "Dal (1 bowl)", "protein_g": 12},
    {"name": "Eggs (2 boiled)", "protein_g": 14},
    {"name": "Curd (200g)", "protein_g": 8},
    {"name": "Chicken Breast (100g)", "protein_g": 31},
    {"name": "Peanut Butter (2 tbsp)", "protein_g": 8},
    {"name": "Sprouts (1 cup)", "protein_g": 14},
    {"name": "Tofu (100g)", "protein_g": 17},
    {"name": "Milk (1 glass)", "protein_g": 8},
]


def get_protein_recommendations(
    protein_logged: float, protein_goal: float
) -> List[dict]:
    """Return high-protein food suggestions if intake is below 80% of goal."""
    if protein_goal <= 0:
        return []
    ratio = protein_logged / protein_goal
    if ratio >= 0.8:
        return []
    return PROTEIN_FOODS
