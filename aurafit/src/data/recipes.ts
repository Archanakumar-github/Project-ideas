import type { MealSection, Recipe } from '../types'

/**
 * Meal templates the planner scales to each meal's calorie target. Ingredient amounts are a
 * base portion; diet compatibility (vegan, gluten-free, keto, ...) is derived from the
 * ingredients, so templates never need hand-maintained diet tags.
 */
function r(
  id: string,
  name: string,
  sections: MealSection[],
  items: Array<[string, number]>,
  minutes: number,
  cuisine?: string,
  steps?: string[],
): Recipe {
  return { id, name, sections, items, minutes, cuisine, steps }
}

const B: MealSection[] = ['breakfast']
const L: MealSection[] = ['lunch']
const D: MealSection[] = ['dinner']
const LD: MealSection[] = ['lunch', 'dinner']
const S: MealSection[] = ['snacks']

export const RECIPES: Recipe[] = [
  // ------------------------------------------------------------------ breakfast
  r('protein-oats', 'Protein oats with berries', B, [['oats', 50], ['milk', 200], ['whey', 25], ['berries', 80], ['chia', 10]], 8, 'Western', [
    'Simmer oats in milk for 4–5 minutes.',
    'Take off the heat, stir in the whey, top with berries and chia.',
  ]),
  r('pb-overnight-oats', 'Peanut butter overnight oats', B, [['oats', 50], ['soy-milk', 200], ['peanut-butter', 16], ['banana', 60], ['chia', 10]], 5, 'Western', [
    'Mix oats, chia and soy milk in a jar; refrigerate overnight.',
    'Top with sliced banana and peanut butter.',
  ]),
  r('yogurt-bowl', 'Greek yogurt bowl with walnuts', B, [['greek-yogurt', 250], ['berries', 100], ['walnuts', 15], ['honey', 7]], 3, 'Mediterranean'),
  r('veggie-omelette', 'Veggie omelette & toast', B, [['egg', 150], ['spinach', 40], ['tomato', 60], ['bell-pepper', 40], ['olive-oil', 5], ['wholewheat-bread', 32]], 10, 'Western', [
    'Sauté peppers and spinach in the oil for 2 minutes.',
    'Pour in the beaten eggs, cook until just set, fold.',
    'Serve with toast and sliced tomato.',
  ]),
  r('avocado-egg-toast', 'Eggs on avocado toast', B, [['egg', 100], ['wholewheat-bread', 64], ['avocado', 50], ['tomato', 40]], 8, 'Western'),
  r('tofu-scramble', 'Tofu scramble with spinach', B, [['tofu', 180], ['spinach', 50], ['onion', 30], ['bell-pepper', 40], ['olive-oil', 7], ['wholewheat-bread', 32]], 12, 'Western', [
    'Crumble tofu into a hot pan with the oil and onion.',
    'Add turmeric, pepper and spinach; cook 3 minutes. Serve with toast.',
  ]),
  r('chia-pudding', 'Mango chia pudding', B, [['chia', 30], ['soy-milk', 250], ['mango', 100], ['pumpkin-seeds', 10]], 5, 'Western'),
  r('poha-curd', 'Vegetable poha with peanuts & curd', B, [['poha', 50], ['peas', 30], ['onion', 30], ['peanuts', 12], ['olive-oil', 5], ['yogurt', 150]], 15, 'Indian', [
    'Rinse poha and drain. Temper mustard seeds and curry leaves in oil, add onion and peas.',
    'Fold in poha with turmeric and salt, steam 2 minutes; finish with peanuts and lemon. Curd on the side.',
  ]),
  r('besan-chilla', 'Besan chilla with paneer', B, [['besan', 50], ['paneer', 40], ['onion', 20], ['tomato', 30], ['olive-oil', 5]], 15, 'Indian', [
    'Whisk besan with water, spices, onion and tomato into a thin batter.',
    'Cook like a crêpe; fill with crumbled paneer.',
  ]),
  r('idli-sambar', 'Idli with sambar', B, [['idli', 160], ['sambar', 220]], 10, 'Indian'),
  r('cottage-toast', 'Cottage cheese & tomato toast', B, [['cottage-cheese', 150], ['wholewheat-bread', 64], ['tomato', 60]], 5, 'Western'),
  r('protein-smoothie', 'Berry protein smoothie', B, [['banana', 100], ['berries', 80], ['whey', 30], ['milk', 250], ['oats', 20]], 4, 'Western'),
  r('vegan-smoothie', 'Plant protein smoothie', B, [['banana', 100], ['berries', 80], ['pea-protein', 30], ['soy-milk', 250], ['flax', 10]], 4, 'Western'),
  r('keto-eggs', 'Eggs, avocado & buttered spinach', B, [['egg', 150], ['avocado', 75], ['spinach', 50], ['butter', 7]], 8, 'Western'),
  r('salmon-scramble', 'Smoked salmon scramble', B, [['egg', 100], ['salmon', 60], ['spinach', 30], ['butter', 5]], 8, 'Western'),
  r('egg-white-wrap', 'Egg-white veggie wrap', B, [['egg-white', 150], ['ww-tortilla', 60], ['spinach', 30], ['feta', 20], ['tomato', 40]], 8, 'Mediterranean'),
  r('gf-yogurt-granola', 'Yogurt, banana & seeds', B, [['greek-yogurt', 200], ['banana', 80], ['pumpkin-seeds', 15], ['chia', 10]], 3, 'Western'),

  // ------------------------------------------------------------------ lunch & dinner
  r('chicken-quinoa-bowl', 'Chicken, quinoa & roast veg bowl', L, [['chicken-breast', 140], ['quinoa', 150], ['broccoli', 80], ['bell-pepper', 60], ['olive-oil', 8]], 25, 'Western', [
    'Roast broccoli and pepper with the oil at 220 °C for 18 minutes.',
    'Slice the chicken and serve over quinoa with the veg and lemon.',
  ]),
  r('turkey-hummus-wrap', 'Turkey & hummus wrap', L, [['turkey-mince', 100], ['ww-tortilla', 60], ['hummus', 30], ['salad-greens', 40], ['tomato', 40]], 10, 'Mediterranean'),
  r('tuna-chickpea-salad', 'Tuna & chickpea salad', L, [['tuna', 120], ['chickpeas', 80], ['salad-greens', 60], ['cucumber', 60], ['tomato', 60], ['olive-oil', 10]], 8, 'Mediterranean'),
  r('lentil-power-bowl', 'Lentil & sweet potato power bowl', LD, [['lentils', 180], ['sweet-potato', 150], ['spinach', 40], ['tahini', 15], ['pumpkin-seeds', 10]], 25, 'Mediterranean', [
    'Roast cubed sweet potato for 25 minutes.',
    'Toss warm lentils with spinach; top with potato, tahini-lemon drizzle and seeds.',
  ]),
  r('greek-chickpea-salad', 'Greek chickpea salad', L, [['chickpeas', 150], ['cucumber', 80], ['tomato', 80], ['feta', 30], ['olive-oil', 10], ['olives', 15]], 10, 'Mediterranean'),
  r('dal-rice', 'Dal tadka with rice & salad', LD, [['lentils', 200], ['basmati', 150], ['olive-oil', 7], ['cucumber', 60], ['tomato', 50]], 30, 'Indian', [
    'Simmer lentils with turmeric until soft.',
    'Temper cumin, garlic and chilli in the oil; pour over the dal. Serve with rice and salad.',
  ]),
  r('rajma-rice', 'Rajma (kidney bean curry) with rice', LD, [['kidney-beans', 180], ['curry-base', 100], ['basmati', 150], ['olive-oil', 5]], 30, 'Indian'),
  r('paneer-tikka-roti', 'Paneer tikka with roti & raita', LD, [['paneer', 100], ['roti', 80], ['bell-pepper', 50], ['onion', 30], ['yogurt', 60], ['cucumber', 60]], 25, 'Indian', [
    'Marinate paneer and peppers in yogurt, chilli and garam masala.',
    'Grill or air-fry 10–12 minutes; serve with roti and cucumber raita.',
  ]),
  r('chicken-curry-rice', 'Chicken curry with basmati', LD, [['chicken-breast', 150], ['curry-base', 120], ['basmati', 150], ['spinach', 40]], 30, 'Indian'),
  r('salmon-poke', 'Salmon poke bowl', L, [['salmon', 120], ['white-rice', 150], ['edamame', 50], ['cucumber', 50], ['soy-sauce', 10], ['avocado', 40]], 15, 'Asian'),
  r('tofu-noodles', 'Tofu & veg rice noodles', LD, [['tofu', 150], ['rice-noodles', 150], ['mixed-veg', 120], ['soy-sauce', 10], ['olive-oil', 7]], 15, 'Asian'),
  r('beef-burrito-bowl', 'Beef burrito bowl', LD, [['beef-mince', 120], ['brown-rice', 150], ['black-beans', 80], ['salsa', 60], ['salad-greens', 40], ['cheddar', 15]], 20, 'Mexican'),
  r('egg-avocado-sandwich', 'Egg & avocado sandwich', L, [['egg', 100], ['wholewheat-bread', 64], ['avocado', 40], ['salad-greens', 30]], 10, 'Western'),
  r('tempeh-buddha', 'Tempeh Buddha bowl', LD, [['tempeh', 120], ['quinoa', 150], ['broccoli', 80], ['carrot', 50], ['tahini', 15]], 20, 'Asian'),
  r('shrimp-stirfry', 'Garlic shrimp stir-fry with rice', LD, [['shrimp', 150], ['white-rice', 150], ['mixed-veg', 120], ['olive-oil', 8], ['soy-sauce', 10]], 15, 'Asian'),
  r('keto-chicken-salad', 'Chicken Caesar-style salad', L, [['chicken-breast', 150], ['salad-greens', 80], ['parmesan', 15], ['avocado', 50], ['olive-oil', 15]], 10, 'Western'),
  r('chana-masala-roti', 'Chana masala with roti', LD, [['chickpeas', 180], ['curry-base', 100], ['roti', 80]], 25, 'Indian'),
  r('turkey-bolognese', 'Turkey bolognese with wholewheat pasta', LD, [['turkey-mince', 120], ['wholewheat-pasta', 180], ['marinara', 120], ['spinach', 30]], 25, 'Italian'),
  r('salmon-sweet-potato', 'Baked salmon, sweet potato & greens', D, [['salmon', 140], ['sweet-potato', 200], ['green-beans', 100], ['olive-oil', 5]], 30, 'Western', [
    'Bake salmon and sweet potato wedges at 200 °C (salmon 12–15 min, potato 25 min).',
    'Steam the beans; finish with lemon.',
  ]),
  r('chicken-stirfry', 'Chicken & veg stir-fry with brown rice', D, [['chicken-breast', 150], ['brown-rice', 150], ['mixed-veg', 150], ['soy-sauce', 10], ['olive-oil', 8]], 20, 'Asian'),
  r('steak-potatoes', 'Sirloin, potatoes & broccoli', D, [['sirloin', 150], ['potato', 200], ['broccoli', 120], ['olive-oil', 5]], 25, 'Western'),
  r('tofu-coconut-curry', 'Tofu & chickpea coconut curry', D, [['tofu', 120], ['chickpeas', 80], ['coconut-milk', 100], ['spinach', 50], ['basmati', 130]], 25, 'Indian'),
  r('lentil-bolognese', 'Lentil bolognese with pasta', D, [['lentils', 150], ['wholewheat-pasta', 160], ['marinara', 150], ['mushrooms', 50], ['carrot', 40], ['olive-oil', 5]], 25, 'Italian'),
  r('paneer-bhurji-roti', 'Paneer bhurji with roti', D, [['paneer', 110], ['onion', 40], ['tomato', 60], ['bell-pepper', 40], ['roti', 80], ['olive-oil', 5]], 20, 'Indian'),
  r('lemon-cod-quinoa', 'Lemon cod with quinoa & asparagus', D, [['cod', 180], ['quinoa', 150], ['asparagus', 100], ['olive-oil', 8]], 20, 'Mediterranean'),
  r('turkey-chili', 'Turkey & bean chili', D, [['turkey-mince', 130], ['kidney-beans', 100], ['marinara', 150], ['bell-pepper', 60], ['onion', 40], ['brown-rice', 100]], 35, 'Mexican'),
  r('black-bean-tacos', 'Black bean & veggie tacos', D, [['black-beans', 150], ['corn-tortilla', 78], ['bell-pepper', 60], ['avocado', 50], ['salsa', 60]], 15, 'Mexican'),
  r('keto-salmon', 'Salmon with buttery greens', D, [['salmon', 160], ['spinach', 100], ['zucchini', 120], ['butter', 10], ['avocado', 50]], 20, 'Western'),
  r('chicken-cauli-mash', 'Chicken thighs with cauliflower mash', D, [['chicken-thigh', 170], ['cauliflower', 200], ['butter', 10], ['broccoli', 100], ['cheddar', 20]], 30, 'Western'),
  r('pork-roast-veg', 'Pork tenderloin with roast veg', D, [['pork-tenderloin', 150], ['potato', 180], ['carrot', 80], ['green-beans', 80], ['olive-oil', 7]], 35, 'Western'),
  r('dal-palak-rice', 'Dal palak (spinach dal) with rice', D, [['moong-dal', 200], ['spinach', 80], ['basmati', 140], ['ghee', 5]], 25, 'Indian'),
  r('egg-fried-rice', 'Egg & veg fried rice', D, [['egg', 100], ['egg-white', 100], ['white-rice', 160], ['peas', 50], ['mixed-veg', 80], ['soy-sauce', 10], ['olive-oil', 7]], 15, 'Asian'),
  r('tempeh-stirfry', 'Tempeh & broccoli noodles', D, [['tempeh', 130], ['rice-noodles', 150], ['broccoli', 100], ['soy-sauce', 10], ['olive-oil', 5]], 15, 'Asian'),
  r('shrimp-zoodles', 'Shrimp & zucchini noodles', D, [['shrimp', 180], ['zucchini', 250], ['olive-oil', 15], ['tomato', 60], ['feta', 20]], 15, 'Mediterranean'),
  r('seitan-fajitas', 'Seitan fajita wraps', LD, [['seitan', 130], ['ww-tortilla', 60], ['bell-pepper', 80], ['onion', 40], ['salsa', 50], ['avocado', 40]], 15, 'Mexican'),

  // ------------------------------------------------------------------ snacks
  r('apple-pb', 'Apple & peanut butter', S, [['apple', 150], ['peanut-butter', 16]], 2),
  r('yogurt-berries', 'Greek yogurt & berries', S, [['greek-yogurt', 170], ['berries', 60], ['honey', 5]], 2),
  r('whey-shake', 'Protein shake', S, [['whey', 30], ['milk', 250]], 2),
  r('plant-shake', 'Plant protein shake', S, [['pea-protein', 30], ['soy-milk', 250]], 2),
  r('almonds-orange', 'Almonds & an orange', S, [['almonds', 25], ['orange', 130]], 1),
  r('hummus-veg', 'Hummus & veggie sticks', S, [['hummus', 60], ['carrot', 80], ['cucumber', 80], ['bell-pepper', 50]], 4),
  r('cottage-berries', 'Cottage cheese & berries', S, [['cottage-cheese', 150], ['berries', 80]], 2),
  r('boiled-eggs', 'Boiled eggs & cucumber', S, [['egg', 100], ['cucumber', 80]], 10),
  r('edamame-snack', 'Salted edamame', S, [['edamame', 150]], 5),
  r('roasted-chickpeas', 'Roasted chickpeas', S, [['chickpeas', 100], ['olive-oil', 5]], 25),
  r('protein-bar-snack', 'Protein bar', S, [['protein-bar', 60]], 0),
  r('dates-walnuts', 'Dates & walnuts', S, [['dates', 30], ['walnuts', 15]], 1),
  r('rice-cake-pb', 'Rice cakes, peanut butter & banana', S, [['rice-cakes', 18], ['peanut-butter', 16], ['banana', 50]], 2),
  r('cheese-olives', 'Cheese, olives & cucumber', S, [['cheddar', 30], ['cucumber', 100], ['olives', 20]], 2),
  r('seeds-dates', 'Pumpkin seeds & dates', S, [['pumpkin-seeds', 20], ['dates', 24]], 1),
  r('popcorn-snack', 'Air-popped popcorn', S, [['popcorn', 30]], 5),
  r('dark-choc-strawberries', 'Strawberries & dark chocolate', S, [['strawberries', 150], ['dark-chocolate', 15]], 1),
]

export const RECIPE_BY_ID = new Map(RECIPES.map((x) => [x.id, x]))
