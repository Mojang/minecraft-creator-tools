# Complex function with multiple commands
execute @a[scores={test=1}] ~ ~ ~ say "Score is 1"
execute @a[scores={test=2..5}] ~ ~ ~ give @s minecraft:diamond 1
execute @a[scores={test=6..}] ~ ~ ~ summon test:sample_entity ~ ~ ~

# Test scoreboard commands
scoreboard objectives add test dummy "Test Objective"
scoreboard players add @a test 1

# Test particle effects
particle test:sample_particle ~ ~ ~

# Test sound effects
playsound random.click @a ~ ~ ~ 1 1 1

# Test conditional commands
execute @a[tag=special] ~ ~ ~ function test:special_function

# Test entity manipulation
tp @e[type=test:sample_entity] ~ ~1 ~
effect give @a minecraft:speed 30 1 true

# Test block manipulation
setblock ~ ~ ~ test:sample_block
fill ~-2 ~-2 ~-2 ~2 ~2 ~2 minecraft:air replace minecraft:stone