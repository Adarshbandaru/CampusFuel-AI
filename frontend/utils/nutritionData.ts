export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: string;
}

export const NUTRITION_DATABASE: Record<string, NutritionInfo> = {
  // ─── Core Mess Foods ───────────────────────────────────────────────────────
  "Rice":           { calories: 195, protein: 4,   carbs: 43,  fat: 0.5, unit: "bowl"   },
  "Dal":            { calories: 150, protein: 9,   carbs: 24,  fat: 3,   unit: "bowl"   },
  "Chapati":        { calories: 70,  protein: 3,   carbs: 15,  fat: 0.4, unit: "piece"  },
  "Paneer":         { calories: 265, protein: 18,  carbs: 4,   fat: 20,  unit: "100g"   },
  "Curd":           { calories: 98,  protein: 4,   carbs: 5,   fat: 7,   unit: "cup"    },
  "Milk":           { calories: 120, protein: 6,   carbs: 10,  fat: 6,   unit: "glass"  },
  "Banana":         { calories: 105, protein: 1.3, carbs: 27,  fat: 0.4, unit: "piece"  },
  "Oats":           { calories: 150, protein: 5,   carbs: 27,  fat: 3,   unit: "bowl"   },
  "Peanut Butter":  { calories: 94,  protein: 4,   carbs: 3,   fat: 8,   unit: "tbsp"   },
  "Veg Curry":      { calories: 120, protein: 3,   carbs: 14,  fat: 6,   unit: "bowl"   },

  // ─── Extended Mess & Hostel Foods ──────────────────────────────────────────
  "Sambar":         { calories: 90,  protein: 4,   carbs: 14,  fat: 2,   unit: "bowl"   },
  "Idli":           { calories: 39,  protein: 2,   carbs: 8,   fat: 0.2, unit: "piece"  },
  "Dosa":           { calories: 168, protein: 4,   carbs: 32,  fat: 3,   unit: "piece"  },
  "Poha":           { calories: 180, protein: 3,   carbs: 35,  fat: 4,   unit: "bowl"   },
  "Upma":           { calories: 200, protein: 5,   carbs: 38,  fat: 5,   unit: "bowl"   },
  "Paratha":        { calories: 260, protein: 5,   carbs: 36,  fat: 10,  unit: "piece"  },
  "Egg":            { calories: 78,  protein: 6,   carbs: 0.6, fat: 5,   unit: "piece"  },
  "Boiled Egg":     { calories: 78,  protein: 6,   carbs: 0.6, fat: 5,   unit: "piece"  },
  "Chickpea Curry": { calories: 270, protein: 15,  carbs: 40,  fat: 6,   unit: "bowl"   },
  "Rajma":          { calories: 230, protein: 13,  carbs: 40,  fat: 3,   unit: "bowl"   },

  // ─── Snacks & Hostel Staples ───────────────────────────────────────────────
  "Bread":          { calories: 79,  protein: 3,   carbs: 15,  fat: 1,   unit: "slice"  },
  "Peanuts":        { calories: 166, protein: 7.3, carbs: 6,   fat: 14,  unit: "handful"},
  "Apple":          { calories: 95,  protein: 0.5, carbs: 25,  fat: 0.3, unit: "piece"  },
  "Orange":         { calories: 62,  protein: 1.2, carbs: 15,  fat: 0.2, unit: "piece"  },
  "Protein Bar":    { calories: 200, protein: 20,  carbs: 22,  fat: 6,   unit: "bar"    },
  "Whey Protein":   { calories: 120, protein: 25,  carbs: 3,   fat: 1.5, unit: "scoop"  },
  "Biscuits":       { calories: 135, protein: 2,   carbs: 21,  fat: 5,   unit: "pack"   },
  "Instant Noodles":{ calories: 380, protein: 9,   carbs: 55,  fat: 14,  unit: "pack"   },
};
