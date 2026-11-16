# Промты для графики Crowns & Ruins

Игра читает спрайт-листы из `client/assets/*.png` по манифесту `client/assets/atlas.json`.
Пока файла нет — рисуется плейсхолдер, так что листы можно добавлять по одному.

## Общие правила для всех листов

1. **Один промт = один лист с сеткой объектов.** Сетка строго равномерная: все ячейки одинакового размера, объекты по центру ячейки. Игра режет картинку на `cols × rows` равных прямоугольников, поэтому разрешение может быть любым, но пропорция должна совпадать (например 4×3 → 2048×1536 или 1024×768).
2. **Порядок объектов** — слева направо, сверху вниз, ровно как в списке. Если генератор перепутал порядок — проще переставить кадры в `atlas.json` (поле `frames`), чем перегенерировать.
3. **Фон**: прозрачный (PNG). Если генератор не умеет прозрачность — проси ровный однотонный фон `#FF00FF` (маджента) или ровный зелёный, затем удали фон (remove.bg, Photoshop «Цветовой диапазон», GIMP «Выделение по цвету»).
4. **Без текста, подписей, рамок, водяных знаков, теней на фоне** — иначе они попадут в игру.
5. **Единый стиль** во всех листах. Ниже используется стиль-блок, добавляй его к каждому промту:

> **STYLE BLOCK:** `stylized medieval fantasy game art, isometric 2:1 projection (camera tilted 30° from above, looking down-right), hand-painted look with clean edges, rich warm colors, soft ambient occlusion, consistent light from top-left, mobile strategy game asset sheet, no text, no labels, no watermark, each object centered in its own grid cell, uniform grid with equal cells, transparent background`

6. Генерируй в максимальном разрешении, желательно квадратные ячейки ≥256 px (для героев и боссов ≥512 px).
7. Негативный промт (если поддерживается): `text, letters, watermark, frame, border, labels, blurry, cropped, overlapping objects, shadow outside cell, perspective camera, photo`.

## Опорные точки (как игра накладывает картинку)

- **terrain** — ромб тайла должен занимать всю ширину ячейки, центр ромба = центр ячейки, высота ромба = половина ширины (2:1).
- **buildings / world / misc / units / heroes / bosses** — объект стоит на изометрическом основании, основание прижато к **нижнему краю** ячейки, ширина основания ≈ 80–90 % ширины ячейки. Верх — свободный, можно высокие шпили.
- **icons** — объект по центру, занимает ~80 % ячейки.

---

## 1. terrain.png — тайлы местности (сетка 4×2, 8 ячеек)

```
Sprite sheet of 8 isometric ground tiles arranged in a strict 4x2 grid of equal square cells. Each tile is a flat 2:1 isometric diamond (rhombus) filling the full width of its cell, centered vertically, seamless-looking surface, no objects on top, no outlines outside the diamond.
Order left to right, top to bottom:
1 lush green grass meadow, 2 dry brown dirt and gravel, 3 dense dark forest canopy seen from above, 4 grey rocky mountain with snow-free peaks, 5 deep blue lake water with light ripples, 6 pale sandy beach, 7 murky green swamp with reeds, 8 white snow field with frost.
STYLE BLOCK
```

## 2. buildings.png — здания города (сетка 4×3, 12 ячеек)

```
Sprite sheet of 12 medieval fantasy town buildings arranged in a strict 4x3 grid of equal square cells, each building standing on a small isometric diamond base aligned to the bottom edge of its cell, base width about 85% of the cell, buildings fully inside their cell, same scale across all cells.
Order left to right, top to bottom:
1 Town Hall: grand stone keep with red tiled roof, banners and a clock tower;
2 Farm: wooden farmhouse with wheat field and windmill;
3 Sawmill: log cabin with stacked timber and a water wheel;
4 Quarry: open rock pit with wooden crane and cut stone blocks;
5 Iron Mine: mine entrance in a rock with rails, ore cart and lanterns;
6 Warehouse: big timber-frame storehouse with barrels and crates;
7 Barracks: stone military building with training yard, weapon racks and a flag;
8 Tavern: cozy two-story inn with a hanging sign, lanterns and a chimney;
9 Wall: a section of thick stone city wall with battlements and a gate;
10 Tower: tall stone watchtower with ballista on top;
11 Market: colorful market stalls with awnings, goods and a fountain;
12 Blacksmith: forge with anvil, glowing furnace and smoke.
STYLE BLOCK
```

Опционально второй лист `buildings_lvl2.png` в той же сетке — «улучшенные» версии зданий (золотые крыши, больше деталей), если захочешь менять вид по уровню.

## 3. world.png — объекты карты мира (сетка 4×2, 8 ячеек)

```
Sprite sheet of 8 isometric world-map objects for a medieval strategy game, strict 4x2 grid of equal square cells, each object on an isometric base aligned to the bottom edge of its cell, same scale.
Order left to right, top to bottom:
1 Player castle town: walled city with golden rooftops and blue banners (friendly);
2 Rival castle town: walled city with dark grey walls and red banners (enemy);
3 Boss lair: ominous cave entrance with skulls, bones, purple magical glow;
4 Forest resource node: cluster of tall pine trees with a lumber camp;
5 Stone resource node: pile of grey boulders and quarried rock;
6 Iron resource node: rocky outcrop with dark metallic ore veins and a pickaxe;
7 Gold resource node: glittering gold vein in rock with gold nuggets;
8 Farmland resource node: golden wheat fields with hay bales.
STYLE BLOCK
```

## 4. misc.png — декор (сетка 4×1, 4 ячейки)

```
Sprite sheet of 4 isometric decoration props, strict 4x1 grid of equal square cells, each prop centered horizontally and aligned to the bottom edge of its cell.
Order left to right:
1 Construction site: wooden scaffolding, ladders, pile of planks and stone, small crane;
2 Oak tree, lush green, round canopy;
3 Grey mossy boulder;
4 Small green bush with berries.
STYLE BLOCK
```

## 5. units.png — отряды (сетка 3×2, 6 ячеек)

```
Sprite sheet of 6 medieval army unit characters, strict 3x2 grid of equal square cells, full body, 3/4 view facing down-right matching an isometric camera, each character centered and standing on the bottom edge of its cell, same scale, chibi-proportioned stylized soldiers.
Order left to right, top to bottom:
1 Militia: peasant with pitchfork and leather vest;
2 Swordsman: soldier in chainmail with sword and round shield;
3 Archer: ranger in green hood with longbow and quiver;
4 Knight: heavy plate-armored knight with lance on armored horse;
5 Catapult: wooden siege catapult with two crew members;
6 Scout: light rider on a fast horse with a spyglass.
STYLE BLOCK
```

## 6. heroes.png — герои (сетка 2×2, 4 ячейки, ячейка ≥512 px)

```
Sprite sheet of 4 fantasy hero characters, strict 2x2 grid of equal square cells, full body, heroic pose, 3/4 view facing down-right, each hero centered and standing on the bottom edge of its cell, same scale, more detailed than regular soldiers, glowing accents.
Order left to right, top to bottom:
1 Knight hero: paladin in ornate golden plate armor with a tower shield and glowing sword;
2 Archer hero: elven huntress in emerald cloak with an enchanted silver bow;
3 Mage hero: old wizard in blue star-covered robe with a staff and a fireball;
4 Rogue hero: hooded assassin in dark leather with twin daggers and a bag of gold.
STYLE BLOCK
```

Если нужны отдельные портреты для панели героев — тот же промт, но «head and shoulders portrait, square frame», сохранить как `heroes_portraits.png` (пока в игре не используется).

## 7. bosses.png — боссы мира (сетка 3×2, 6 ячеек, ячейка ≥512 px)

```
Sprite sheet of 6 epic fantasy boss monsters for a medieval strategy game, strict 3x2 grid of equal square cells, each monster centered and standing on the bottom edge of its cell, same scale, menacing poses, dramatic rim light, 3/4 view facing down-right.
Order left to right, top to bottom:
1 Troll King: huge green troll with a crown of bones and a tree-trunk club;
2 Wolf Matriarch: giant grey dire wolf with glowing eyes and scars;
3 Bandit Lord: brutal outlaw chieftain in fur and iron with two axes, surrounded by loot;
4 Lich: skeletal undead sorcerer in tattered purple robes with a soul-gem staff and green fire;
5 Ancient Dragon: massive red dragon with spread wings breathing fire;
6 Demon Lord: towering horned demon with lava-cracked skin and a flaming greatsword.
STYLE BLOCK
```

## 8. icons.png — иконки ресурсов и UI (сетка 4×2, 8 ячеек, ячейка 128–256 px)

```
Sprite sheet of 8 game resource icons, strict 4x2 grid of equal square cells, each icon centered and filling about 80% of its cell, bold readable silhouettes, slight glossy highlight, thick dark outline, mobile game UI style.
Order left to right, top to bottom:
1 Food: loaf of bread with a red apple;
2 Wood: three stacked timber logs;
3 Stone: grey stone blocks;
4 Iron: dark iron ingot;
5 Gold: pile of gold coins;
6 Power: crossed swords on a red shield;
7 Time: brass hourglass;
8 Experience: glowing purple star.
STYLE BLOCK (background transparent, no isometric base for icons)
```

Сейчас иконки в верхней панели — это цветные кружки из CSS (`.ico-*` в `client/css/style.css`). Чтобы подключить `icons.png`, замени фон этих классов на `background: url(../assets/icons.png)` с `background-size` под сетку, либо скажи мне — подключу.

## 9. Дополнительно (не обязательно для запуска)

- **Фон экрана входа** `login_bg.png`: `medieval fantasy castle on a hill at golden sunset, isometric town below, dramatic clouds, wide 9:16 vertical composition, no text` — подключается в `#auth` через CSS.
- **Иконка приложения** 512×512: `app icon, golden crown over a stone castle gate, red banner, dark round background, flat bold game icon, no text`.
- **Логотип** `Crowns & Ruins` — лучше сделать текстом/шрифтом, генераторы плохо пишут буквы.

## Как подключить

1. Положи PNG в `client/assets/` с именами из `atlas.json`: `terrain.png`, `buildings.png`, `world.png`, `misc.png`, `units.png`, `heroes.png`, `bosses.png`, `icons.png`.
2. Проверь, что ширина/высота картинки делятся на число колонок/строк без остатка.
3. Обнови страницу — игра подхватит листы, ничего больше менять не нужно.
4. Если объект в ячейке «ездит» (сдвинут от низа или слишком мелкий), можно подвинуть сам PNG, или скажи — добавлю в `atlas.json` поля смещения/масштаба на кадр.
