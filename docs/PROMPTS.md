# Промты для графики Crowns & Ruins

Игра читает спрайт-листы из `client/assets/*.png` по манифесту `client/assets/atlas.json`.
Пока файла нет — рисуется плейсхолдер, так что листы можно добавлять по одному и сразу смотреть результат.

## Общие правила

1. **Один промт = один лист с сеткой объектов.** Сетка строго равномерная, объекты по центру ячеек. Игра режет картинку на `cols × rows` равных частей: разрешение любое, важна пропорция (4×4 → квадрат, 4×2 → 2:1, 6×4 → 3:2).
2. **Порядок объектов** — слева направо, сверху вниз, ровно как в списке. Если генератор перепутал — проще переставить имена в `atlas.json` (поле `frames`), чем перегенерировать.
3. **Фон**: прозрачный PNG. Если генератор не умеет прозрачность — проси ровный фон `#FF00FF` (маджента) и удаляй его (remove.bg, Photoshop «Цветовой диапазон», GIMP «Выделение по цвету»).
4. **Никакого текста, подписей, рамок, водяных знаков, теней за пределами ячейки.**
5. **Единый стиль** — к каждому промту добавляй этот блок:

> **STYLE:** `premium medieval fantasy strategy game art, hand-painted AAA mobile game quality (like Rise of Kingdoms / Total War: Kingdom style), isometric 2:1 projection with camera tilted ~35° from above looking down-right, rich saturated colors, warm golden sunlight from the top-left, soft ambient occlusion, detailed stone, wood, iron and cloth textures, subtle weathering, crisp readable silhouettes, clean edges, no outline strokes, sprite sheet on a strict uniform grid of equal cells, each object fully inside its own cell and centered, transparent background, no text, no labels, no watermark, no frame`

6. **Негативный промт** (если есть поле): `text, letters, numbers, watermark, signature, frame, border, labels, blurry, low detail, cropped, overlapping objects, shadow outside cell, perspective camera, photo, 3d render look, cartoon flat, pixel art`.
7. Разрешение — максимальное. Ячейки ≥256 px, для героев и боссов ≥512 px, иконки ≥128 px. Лучше генерировать в 2048 px по широкой стороне и апскейлить.
8. Делай по 2–3 варианта и выбирай лучший — для сеток генераторы часто ошибаются в количестве ячеек. Проверяй, что ячеек ровно столько, сколько надо.

## Опорные точки (как игра накладывает картинку)

- **terrain** — ромб тайла занимает всю ширину ячейки, центр ромба = центр ячейки, высота ромба = половина ширины (2:1).
- **buildings / world / misc / units / heroes / bosses / monsters** — объект стоит на изометрическом основании, основание прижато к **нижнему краю** ячейки, ширина основания ≈ 80–90 % ширины ячейки. Вверх — свободно (шпили, флаги).
- **icons / items** — объект по центру, занимает ~80 % ячейки.

---

## 1. terrain.png — местность (сетка 4×2, 8 тайлов)

```
Sprite sheet of 8 isometric ground tiles in a strict 4x2 grid of equal square cells. Each tile is a flat 2:1 isometric diamond (rhombus) filling the full width of its cell, centered vertically, richly painted top-down surface, nothing standing on it, edges of the diamond perfectly straight so tiles can be placed side by side seamlessly.
Order left to right, top to bottom:
1 lush green meadow grass with tiny flowers and soft patches,
2 dry trampled brown earth with pebbles and cart ruts,
3 dense dark-green forest canopy seen from above with a few golden autumn trees,
4 grey rocky mountain slopes with cracks and scattered boulders,
5 deep blue lake water with gentle light ripples and sun glitter,
6 pale golden sandy shore with shells,
7 murky green swamp with reeds, lily pads and mist,
8 white snow field with frost and faint blue shadows.
STYLE
```

## 2. buildings.png — здания города (сетка 4×4, 16 зданий)

```
Sprite sheet of 16 medieval fantasy town buildings in a strict 4x4 grid of equal square cells, each building standing on a small isometric diamond base aligned to the bottom edge of its cell, base width about 85% of the cell, same scale in all cells, rich architectural detail: stone walls, timber frames, red and slate tiled roofs, banners, torches, chimneys with smoke.
Order left to right, top to bottom:
1 Town Hall: grand stone keep with a clock tower, golden roof ornaments, royal blue banners, a stone staircase;
2 Farm: cozy farmhouse with a thatched roof, golden wheat plot, a wooden windmill, hay bales;
3 Sawmill: log cabin with a large water wheel, stacked timber and a saw frame;
4 Quarry: open rock pit with a wooden crane, cut stone blocks and a cart;
5 Iron Mine: mine entrance in a rocky hill with wooden supports, rail cart, lanterns and ore;
6 Warehouse: big timber-frame storehouse with barrels, crates and sacks under an awning;
7 Barracks: fortified military hall with a training yard, weapon racks, target dummies and a red war banner;
8 Tavern: inviting two-story inn with a hanging sign, warm glowing windows, barrels and a chimney;
9 Wall: section of thick stone city wall with battlements and an iron-studded gate;
10 Tower: tall stone watchtower with a ballista and a lit brazier on top;
11 Market: colorful market stalls with striped awnings, goods, fruit and a small fountain;
12 Blacksmith: forge with an anvil, glowing furnace, hanging tools, smoke;
13 Academy: elegant scholars' hall with a domed observatory, a telescope and stained glass;
14 Hospital: calm white-stone infirmary with a red cross banner, herb garden and a bell tower;
15 Houses: cluster of three small half-timbered cottages with gardens and a well;
16 Embassy: noble manor with columns, a marble staircase and several alliance flags.
STYLE
```

## 3. world.png — объекты карты мира (сетка 4×2, 8 объектов)

```
Sprite sheet of 8 isometric world-map objects for a medieval strategy game, strict 4x2 grid of equal square cells, each object on an isometric base aligned to the bottom edge of its cell, same scale.
Order left to right, top to bottom:
1 Player castle town: majestic walled city with golden rooftops, blue banners and a tall keep (friendly);
2 Rival castle town: grim walled city with dark grey walls, red banners and spiked towers (enemy);
3 Boss lair: ominous cave mouth in a black rock with skulls, bones, chains and purple magical glow;
4 Forest resource camp: tall pine trees with a lumberjack camp, logs and an axe in a stump;
5 Stone quarry node: pile of grey boulders, cut stone blocks and a wooden scaffold;
6 Iron ore node: rocky outcrop with dark metallic veins, a pickaxe and a lantern;
7 Gold mine node: glittering gold vein in rock, gold nuggets and a small mine cart;
8 Farmland node: golden wheat fields with hay bales and a scarecrow.
STYLE
```

## 4. misc.png — декор (сетка 4×2, 8 элементов)

```
Sprite sheet of 8 isometric decoration props, strict 4x2 grid of equal square cells, each prop centered horizontally and aligned to the bottom edge of its cell.
Order left to right, top to bottom:
1 Construction site: wooden scaffolding, ladders, piles of planks and stone, a small crane;
2 Big oak tree with a lush round canopy;
3 Grey mossy boulder;
4 Small green bush with red berries;
5 Cobblestone road tile: flat 2:1 isometric diamond of worn cobblestones;
6 River tile: flat 2:1 isometric diamond of clear flowing water with stones;
7 Tall banner pole with a red and gold heraldic flag;
8 Army camp: a canvas tent with a campfire and a spear rack.
STYLE
```

## 5. units.png — отряды (сетка 3×2, 6 отрядов)

```
Sprite sheet of 6 medieval army units, strict 3x2 grid of equal square cells, full body, 3/4 view facing down-right to match an isometric camera, each unit centered and standing on the bottom edge of its cell, same scale, stylized heroic proportions, detailed armor and weapons.
Order left to right, top to bottom:
1 Militia: peasant with a pitchfork, leather vest and a wooden shield;
2 Swordsman: soldier in chainmail with a steel sword and a kite shield with a heraldic emblem;
3 Archer: ranger in a green hood with a longbow and a quiver;
4 Knight: heavy plate-armored knight with a lance on an armored warhorse with a caparison;
5 Catapult: wooden siege catapult with two crew members and a pile of stone shots;
6 Scout: light rider in a brown cloak on a fast horse holding a spyglass.
STYLE
```

## 6. heroes.png — герои (сетка 2×2, 4 героя, ячейка ≥512 px)

```
Sprite sheet of 4 fantasy hero characters, strict 2x2 grid of equal square cells, full body, dynamic heroic pose, 3/4 view facing down-right, each hero centered and standing on the bottom edge of its cell, same scale, noticeably more detailed and ornate than regular soldiers, glowing magical accents.
Order left to right, top to bottom:
1 Knight hero: paladin in ornate golden plate armor with a lion crest, tower shield and a glowing greatsword;
2 Archer hero: elven huntress in an emerald cloak with silver filigree and an enchanted bow with a blue glow;
3 Mage hero: old wizard in a deep blue star-embroidered robe holding a staff with a burning fireball;
4 Rogue hero: hooded assassin in dark leather with twin curved daggers and a bag of gold coins.
STYLE
```

Опционально `heroes_portraits.png` (2×2): тот же промт, но `head-and-shoulders portrait, dramatic rim light, square framing, same four characters` — пригодится для карточек героев позже.

## 7. bosses.png — боссы мира (сетка 3×2, 6 боссов, ячейка ≥512 px)

```
Sprite sheet of 6 epic fantasy boss monsters for a medieval strategy game, strict 3x2 grid of equal square cells, each monster centered and standing on the bottom edge of its cell, same scale, menacing poses, dramatic rim light, 3/4 view facing down-right, very detailed.
Order left to right, top to bottom:
1 Troll King: huge green troll with a crown of bones, a tree-trunk club and tribal war paint;
2 Wolf Matriarch: giant grey dire wolf with glowing amber eyes, scars and a bone collar;
3 Bandit Lord: brutal outlaw chieftain in fur and black iron with two axes, standing on a pile of loot;
4 Lich: skeletal undead sorcerer in tattered purple robes with a soul-gem staff and green ghostly fire;
5 Ancient Dragon: massive red dragon with spread wings, breathing fire, on a hoard of gold;
6 Demon Lord: towering horned demon with lava-cracked skin, a flaming greatsword and dark wings.
STYLE
```

## 8. monsters.png — монстры карты (сетка 4×4, 16 монстров)

```
Sprite sheet of 16 fantasy monsters and enemies for a medieval strategy world map, strict 4x4 grid of equal square cells, each creature centered and standing on the bottom edge of its cell, same scale, 3/4 view facing down-right, threatening but readable silhouettes, ordered from weak to strong.
Order left to right, top to bottom:
1 grey wolf, 2 wild boar with tusks, 3 goblin with a rusty dagger, 4 bandit with a crossbow and a mask,
5 skeleton warrior with a cracked shield, 6 giant black spider, 7 orc brute with a cleaver, 8 ogre with a spiked club,
9 harpy with feathered wings, 10 ghostly wraith in chains, 11 troll with a stone hammer, 12 minotaur with a double axe,
13 dark knight in black spiked armor, 14 three-headed hydra, 15 stone golem with glowing runes, 16 fire demon with horns.
STYLE
```

## 9. items.png — экипировка героев (сетка 6×4, 24 предмета, ячейка ≥128 px)

Строки — ступени качества (от простого к легендарному), столбцы — слоты: оружие, доспех, шлем, сапоги, кольцо, амулет. Редкость в игре подсвечивается цветом рамки, поэтому предметы сами по себе должны выглядеть всё богаче ряд за рядом.

```
Sprite sheet of 24 fantasy RPG equipment icons in a strict 6x4 grid of equal square cells, each item centered and filling about 80% of its cell, painted game inventory icon style, slight glossy highlights, soft drop shadow inside the cell only.
Columns left to right in every row: sword, body armor, helmet, boots, ring, amulet.
Row 1 (crude, worn): rusty short sword, leather vest, leather cap, worn boots, plain copper ring, bone amulet on a cord.
Row 2 (quality steel): polished steel longsword, chainmail hauberk, steel helmet with nose guard, traveler boots with buckles, silver ring with a small gem, amulet of life with a green gem.
Row 3 (enchanted): runed sword with a blue glow, ornate plate armor, horned helmet with gold trim, winged boots with a wind aura, ring of fury with a red gem, phoenix amulet with a fire gem.
Row 4 (legendary, golden): Blade of Kings with golden hilt and radiant light, Dragon armor with scales and gems, War Crown of gold and rubies, Storm boots crackling with lightning, Overlord's signet ring, Heart of the Mountain amulet with a huge glowing crystal.
STYLE (no isometric base for icons)
```

## 10. icons.png — иконки ресурсов (сетка 4×2, 8 иконок, ячейка 128–256 px)

```
Sprite sheet of 8 game resource icons in a strict 4x2 grid of equal square cells, each icon centered and filling about 80% of its cell, bold readable silhouettes, glossy painted mobile game UI style, thin dark outline.
Order left to right, top to bottom:
1 Food: loaf of bread with a red apple and wheat;
2 Wood: three stacked timber logs;
3 Stone: grey cut stone blocks;
4 Iron: dark iron ingot with a metallic sheen;
5 Gold: pile of gold coins;
6 Power: crossed swords on a red shield;
7 Time: brass hourglass with sand;
8 Experience: glowing purple star.
STYLE (no isometric base for icons)
```

## 11. Оформление интерфейса (по желанию)

Сейчас панели нарисованы CSS. Если хочешь «дорогой» вид, сгенерируй `ui.png` (сетка 4×2):

```
Sprite sheet of 8 medieval game UI elements in a strict 4x2 grid of equal cells: 1 ornate panel frame with carved dark wood and gold corners (inner area transparent), 2 parchment scroll background, 3 golden button idle, 4 golden button pressed, 5 red button, 6 round iron-rimmed slot for an icon, 7 header ribbon banner in royal blue with gold trim, 8 small wax seal badge. Painted, rich, high contrast, transparent background, no text.
STYLE
```

И фоны:

- **Экран входа** `login_bg.png` (вертикальный 9:16): `epic medieval fantasy castle on a cliff at golden sunset, isometric town below, banners in the wind, dramatic clouds, painted, no text`.
- **Иконка приложения** 1024×1024: `mobile game app icon, golden crown above a stone castle gate with a red banner, dark round background with gold rim, bold readable, painted, no text`.
- **Сплэш** 2732×2732: тот же мотив, что экран входа, центрированная композиция.

## Как подключить

1. Положи PNG в `client/assets/` с именами из `atlas.json`: `terrain.png`, `buildings.png`, `world.png`, `misc.png`, `units.png`, `heroes.png`, `bosses.png`, `monsters.png`, `items.png`, `icons.png`.
2. Проверь, что ширина и высота делятся на число колонок/строк без остатка.
3. Обнови страницу — игра подхватит листы, ничего больше менять не нужно.
4. Если объект в ячейке «ездит» (сдвинут или мелковат), скажи — добавлю смещение/масштаб на кадр в `atlas.json`.
