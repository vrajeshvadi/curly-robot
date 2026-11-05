import { writeFileSync } from 'node:fs'
const slug = (n) => n.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const ing = (s) => s ? s.split(',').map((p) => { const [n, q] = p.trim().split(' x'); return { itemId: slug(n), qty: Number(q) } }) : []
const items = {}
const add = (it) => { if (items[it.id]) throw new Error('dup ' + it.id); items[it.id] = it }

const machines = [['Feed Mill',1],['Bakery',2],['Dairy',6],['Sugar Mill',7],['Popcorn Pot',8],['BBQ Grill',9],['Pie Oven',14],['Loom',17],['Sewing Machine',19],['Cake Oven',21],['Smelter',24],['Juice Press',26],['Ice Cream Maker',29]]
const animals = [['Chicken',1],['Cow',6],['Pig',10],['Sheep',16]]
const trees = [['Apple Tree',15],['Raspberry Bush',19],['Cherry Tree',22],['Blackberry Bush',26],['Blueberry Bush',30]]
const res = (l) => Object.fromEntries(l.map(([n, lv]) => [slug(n), { id: slug(n), name: n, unlockLevel: lv }]))

// crops: name, level, minutes
for (const [n, lv, m] of [['Wheat',1,2],['Corn',1,5],['Soybean',5,20],['Sugarcane',7,30],['Carrot',9,10],['Indigo',13,120],['Pumpkin',15,180],['Cotton',18,150],['Chili Pepper',25,240],['Tomato',30,360]])
  add({ id: slug(n), name: n, category: 'crop', storage: 'silo', unlockLevel: lv, source: { kind: 'field', seedUsed: 1, harvestYield: 2, minutes: m } })

// tree/bush fruit: name, tree, level, minutes
for (const [n, t, lv, m] of [['Apple','Apple Tree',15,960],['Raspberry','Raspberry Bush',19,1080],['Cherry','Cherry Tree',22,1680],['Blackberry','Blackberry Bush',26,1920],['Blueberry','Blueberry Bush',30,1800]])
  add({ id: slug(n), name: n, category: 'tree', storage: 'silo', unlockLevel: lv, source: { kind: 'tree', treeId: slug(t), yield: 2, minutes: m } })

// animal products: name, animal, level, minutes, feed
for (const [n, a, lv, m, f] of [['Egg','Chicken',1,20,'Chicken Feed x1'],['Milk','Cow',6,60,'Cow Feed x1'],['Bacon','Pig',10,240,'Pig Feed x1'],['Wool','Sheep',16,360,'Sheep Feed x1']])
  add({ id: slug(n), name: n, category: 'animal', storage: 'barn', unlockLevel: lv, source: { kind: 'animal', animalId: slug(a), yield: 1, minutes: m, ingredients: ing(f) } })

// machine goods: name, machine, level, minutes, yield, ingredients
const goods = [
  ['Chicken Feed','Feed Mill',3,5,3,'Wheat x2, Corn x1'],
  ['Cow Feed','Feed Mill',6,10,3,'Soybean x2, Corn x1'],
  ['Pig Feed','Feed Mill',10,20,3,'Carrot x2, Soybean x1'],
  ['Sheep Feed','Feed Mill',16,30,3,'Wheat x3, Soybean x1'],
  ['Bread','Bakery',2,5,1,'Wheat x3'],
  ['Corn Bread','Bakery',7,30,1,'Corn x2, Egg x2'],
  ['Cookie','Bakery',10,60,1,'Wheat x2, Egg x2, Brown Sugar x1'],
  ['Raspberry Muffin','Bakery',19,45,1,'Wheat x2, Raspberry x2, Egg x1'],
  ['Blackberry Muffin','Bakery',26,45,1,'Wheat x1, Egg x2, Blackberry x3'],
  ['Cream','Dairy',6,20,1,'Milk x1'],
  ['Butter','Dairy',9,30,1,'Milk x2'],
  ['Cheese','Dairy',12,60,1,'Milk x3'],
  ['Brown Sugar','Sugar Mill',7,20,1,'Sugarcane x1'],
  ['White Sugar','Sugar Mill',13,40,1,'Sugarcane x2'],
  ['Syrup','Sugar Mill',18,90,1,'Sugarcane x4'],
  ['Popcorn','Popcorn Pot',8,30,1,'Corn x2'],
  ['Buttered Popcorn','Popcorn Pot',16,60,1,'Corn x2, Butter x1'],
  ['Chili Popcorn','Popcorn Pot',25,120,1,'Corn x2, Chili Pepper x2'],
  ['Pancake','BBQ Grill',9,30,1,'Egg x3, Brown Sugar x1'],
  ['Bacon and Eggs','BBQ Grill',11,60,1,'Bacon x2, Egg x4'],
  ['Hamburger','BBQ Grill',18,120,1,'Bread x2, Bacon x2'],
  ['Fish Burger','BBQ Grill',27,60,1,'Bread x2, Fish Fillet x1, Chili Pepper x1'],
  ['Roasted Tomatoes','BBQ Grill',30,60,1,'Tomato x2, Butter x1'],
  ['Carrot Pie','Pie Oven',14,60,1,'Carrot x3, Egg x1, Wheat x2'],
  ['Pumpkin Pie','Pie Oven',15,90,1,'Pumpkin x3, Egg x1, Wheat x2'],
  ['Bacon Pie','Pie Oven',18,120,1,'Bacon x3, Egg x1, Wheat x2'],
  ['Apple Pie','Pie Oven',28,120,1,'Apple x3, Egg x1, Wheat x2'],
  ['Fish Pie','Pie Oven',28,120,1,'Fish Fillet x3, Egg x1, Wheat x2'],
  ['Sweater','Loom',17,60,1,'Wool x2'],
  ['Cotton Fabric','Loom',18,30,1,'Cotton x3'],
  ['Blue Woolly Hat','Loom',19,90,1,'Wool x1, Indigo x2'],
  ['Blue Sweater','Loom',20,120,1,'Wool x2, Indigo x2'],
  ['Cotton Shirt','Sewing Machine',19,60,1,'Cotton Fabric x2'],
  ['Wooly Chaps','Sewing Machine',21,120,1,'Cotton Fabric x1, Wool x2'],
  ['Violet Dress','Sewing Machine',25,180,1,'Cotton Fabric x2, Indigo x2, Raspberry x1'],
  ['Carrot Cake','Cake Oven',21,90,1,'Carrot x2, Egg x2, Cream x1'],
  ['Cream Cake','Cake Oven',23,120,1,'Milk x1, Cream x1, Egg x2'],
  ['Red Berry Cake','Cake Oven',23,120,1,'Raspberry x1, Cream x1, Egg x2'],
  ['Cheesecake','Cake Oven',24,120,1,'Cheese x2, Egg x2, Cream x1'],
  ['Silver Bar','Smelter',24,480,1,'Silver Ore x3'],
  ['Gold Bar','Smelter',25,720,1,'Gold Ore x3'],
  ['Platinum Bar','Smelter',25,960,1,'Platinum Ore x3'],
  ['Carrot Juice','Juice Press',26,30,1,'Carrot x3'],
  ['Apple Juice','Juice Press',28,60,1,'Apple x3'],
  ['Cherry Juice','Juice Press',30,90,1,'Cherry x3'],
  ['Vanilla Ice Cream','Ice Cream Maker',29,120,1,'Milk x1, Cream x1, White Sugar x1'],
]
for (const [n, mach, lv, m, y, i] of goods)
  add({ id: slug(n), name: n, category: 'made', storage: 'barn', unlockLevel: lv, source: { kind: 'machine', machineId: slug(mach), yield: y, minutes: m, ingredients: ing(i) } })

// materials and caught goods (not produced on the farm)
for (const [n, lv] of [['Bolt',1],['Plank',1],['Duct Tape',1],['Nail',1],['Screw',1],['Wood Panel',1],['Land Deed',1],['Mallet',1],['Marker Stake',1],['Axe',1],['Saw',1],['Dynamite',1],['TNT Barrel',1],['Shovel',1],['Pickaxe',1],['Silver Ore',24],['Gold Ore',24],['Platinum Ore',24],['Fish Fillet',27]])
  add({ id: slug(n), name: n, category: 'material', storage: 'barn', unlockLevel: lv, source: { kind: 'none' } })

const catalog = { catalogVersion: 1, items, machines: res(machines), animals: res(animals), trees: res(trees) }
writeFileSync(process.argv[2], JSON.stringify(catalog, null, 1) + '\n')
console.log(Object.keys(items).length, 'items')
