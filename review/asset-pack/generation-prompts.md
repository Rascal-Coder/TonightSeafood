# P0 生成提示记录

## 共享画风锁

`flat 2D Chinese casual-game sticker art, thick wobbly dark-brown ink outline, flat color blocks, one soft inner shadow, one small cream highlight, rounded chubby body, big head, short limbs, clean readable silhouette, warm night-market grill colors, cute, centered, mobile game readability, not 3D, not clay, not pixel art, not photoreal`

透明素材统一要求：纯色 `#FF00FF` 背景、单一主体、居中、四周留白、无文字/水印/Logo/边框/场景/地面阴影。角色统一采用略带倾斜的俯视镜头，头朝画面下方。

## 逐项提示

- `bg_night_stall`：750×1334 夜晚海边大排档空镜；上方深蓝夜空与远海，中间暖灯下的空木桌和铁板，下方留青色水池区；热闹、干净、无人物和文字。
- `pond_water`：750×334 干净青绿色椭圆池水，少量低对比高光，透明边缘。
- `pond_caustic`：256×256 稀疏、柔和、可平铺的浅青色弧形水光。
- `net`：256×256 圆形玩具感渔网，短木柄、暖棕网绳、网口朝上。
- `shrimp_star1`：弯成 C 的粉色小虾，大眼睛，两根短须贴着头，尾扇小，没有钳。
- `shrimp_star2`：同一只弯虾，没有钳。尾扇明显加宽，身上一条粗白环鼓出身体轮廓。浅橙可以有，白环必须是一块外形。
- `shrimp_star3`：仍是弯虾，没有钳。两根须又粗又长，探出头外；背脊鼓起一截。深青和宽虎纹可以有，须和背脊必须先被看见。
- `crab_star1`：青绿小圆壳，两只钳贴着壳，腿短到只是装饰。
- `crab_star2`：壳明显比 1 星更宽，左右鼓出。两钳向外张开。浅色钳尖可以有，先看见的是宽壳和张开的钳。
- `scallop_star1`：一把小扇，粉白，扇边较收，里面一张小脸。
- `fish_star1`：黄色椭圆，大眼，尾巴短而小，鳍贴着身体，头朝画面下方。

升星提示以 `docs/execution/02-png-art-spec-prompt.md` 为准。每一星要多一块鼓出轮廓的外形，不能只换色。已出的虾 2 星、虾 3 星、蟹 2 星是旧的换色稿，按上面的新提示重出。
- `enemy_e001`：圆耳灰老鼠，围干净小餐巾，眼睛明亮，不猥琐。
- `enemy_e002`：更瘦的快跑鼠，耳朵略向后，戴橙色运动汗带。
- `enemy_e005`：白肚子海鸥，橙嘴，翅膀短圆。
- `boss_s001`：大号圆老鼠，干净桶盖盾和小垃圾桶，竞争感而不邪恶。
- `proj_pellet`：单颗白蓝圆水珠。
- `proj_claw`：紧凑的两道钳形水花。
- `proj_fan`：尖端朝上的扇形水波。
- `proj_blade`：朝上的细长水色刀光。
- `proj_chili`：小巧红橙火星。
- `ui_wood_bar`：空心长木牌，圆角，中心完全留空。
- `ui_tray`：空的不锈钢圆角托盘。
- `ui_card`：奶油色空白菜单卡，顶部一条木边。
- `ui_btn`：空白圆角木按钮。
- `ui_lantern`：一盏暖黄摊位灯。
- `ui_coin`：无面额的贝壳金币。
- `fx_bubble`：一颗大青色泡泡和两个紧贴的小泡泡。
- `fx_merge`：青色与暖金能量团汇聚到奶油色亮点。
- `fx_hit`：紧凑的暖黄橙四角命中火花。
- `fx_blob_shadow`：单个深蓝棕低透明度水平软边椭圆影子。

负向约束统一包含：`text, watermark, logo, frame, clay, soft plastic, 3D render, pixar, pixel art, photoreal, gore, horror, dirty, realistic shell texture, extra limbs, multiple characters, background scenery, floor shadow`。

## 敌人静帧补批

画风锁与上面相同。单帧，头朝画面下方，纯色 `#FF00FF`。老鼠家族沿用偷吃鼠的圆耳灰身体，只换道具。

- `enemy_e003`：头上扣一只干净小铁桶，桶是道具不是全身甲。
- `enemy_e004`：干净橘猫，脸颊红晕，步子略歪。
- `enemy_e006`：圆螺壳里露出两只小钳和一张脸，没有围裙和皇冠。
- `enemy_e007`：白猫，鱼纹围巾，嘴里空着。
- `enemy_e008`：浅紫圆伞，短触手，吃惊的小脸。
- `enemy_e009`：方一点的深青章鱼，腕上一条麻绳。
- `enemy_e010`：会走路的白泡沫箱，箱上笑脸，四条小短腿。
- `enemy_e011`：偷吃鼠的身子，一顶高高的白厨师帽。
- `enemy_e012`：小老鼠坐在一只折纸船里。
- `enemy_e013`：钻出后的小蟹，壳上还沾着沙，两只小钳。
- `enemy_e014`：偷吃鼠的身子，一双黄雨靴。
- `enemy_e015`：灰鼠手里一把红勺子，勺子不贴在身上。
- `enemy_e016`：圆翅膀、暖黄肚子的飞蛾，头朝画面下方。

## 精英和 Boss 静帧

画风锁不变。精英 256，Boss 512，桶盖 128。头朝画面下方，纯色 `#FF00FF`。

- `elite_l001`：铁桶鼠，桶上多绑一条红绳。
- `elite_l002`：海鸥，头上一顶小船长帽。
- `elite_l003`：水母，伞盖改成蓝白。
- `elite_l004`：三条圆鱼叠成一张，头朝画面下方。
- `boss_s002`：更大的海鸥船长，船长帽更明确，短翅膀。
- `boss_s003`：巨大圆螺壳，两只大钳。
- `boss_s004`：深蓝圆头章鱼，短腕，圆点吸盘，没有麻绳。
- `boss_s005`：大红蟹，摊主围裙，两只巨钳，没有纸皇冠。
- `boss_s001_lid`：一只干净的圆桶盖，单独一张。

## 新海鲜和弹幕

画风锁不变。海鲜 256，头朝画面下方。弹幕是单颗道具，尖端朝上，纯色 `#FF00FF`。

- `abalone_star1`：一块扁椭圆壳，壳缘一圈肉，脸上朝下。不是两片张开的生蚝。
- `cucumber_star1`：深褐软管，一头圆脸朝下，没有触手。
- `mantis_star1`：比虾更扁，头朝下，头前两只大圆拳。
- `starfish_star1`：五只短臂，中间一张小脸。不是海胆。
- `proj_pearl`：一颗大白珍珠。
- `proj_ink`：一团柔和的深紫墨，不是油污。
- `proj_spike`：一根朝上的圆头短刺。
- `proj_tentacle`：一条朝上的短腕残影，几个圆吸盘。
- `proj_ice`：一颗蓝白冰晶。
- `proj_garlic`：一圈暖金爆香，里面几瓣蒜。
- `proj_slam`：一圈沙色震地波。
- `proj_mucus`：一条朝上的深褐黏液带，没有脸。
- `proj_punch`：朝上的短直线橙拳风。
- `proj_tide`：很小的一滴浅水色。
- `shrimp_star4`：短钳扇尾的大龙虾，头朝下。
- `crab_star3`：壳鼓成暖棕馒头的面包蟹。
- `oyster_star2`：壳更厚、肉更鼓的肥蚝。
- `scallop_star2`：扇纹更清楚的鲜扇贝。
- `squid_star2`：身体稍长、仍然圆的枪乌贼。
- `urchin_star2`：刺稍长、仍然稀疏的刺海胆。
- `fish_star2`：银白、一条深纹的鲈鱼。
- `octopus_star2`：短腕更多的八爪鱼，没有围巾和锅帽。
