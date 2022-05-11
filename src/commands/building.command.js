const { SlashCommandBuilder } = require('@discordjs/builders');
const Player = require('../models/player.model.js');

const buildings = require('../../data/buildings/export.js');
const { checkEnoughMoney } = require('../player.js');
const choices = [];
buildings.forEach(build => {
    if (build.name !== 'Empty')
        choices.push({
            name: `${build.image} ${build.name}`,
            value: build.target
        });
})


module.exports = {
    data: new SlashCommandBuilder()
        .setName('build')
        .setDescription('Build a new building')
        .addIntegerOption(option =>
            option
                .setName('row')
                .setDescription('Build building at row.')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('col')
                .setDescription('Build building at column.')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Building type')
                .setRequired(true)
                .addChoices(...choices)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const player = await Player.findOne({ userId }).exec();

        const row = interaction.options.getInteger('row') - 1;
        const col = interaction.options.getInteger('col') - 1;

        const index = row * player.buildingWidth + col;

        if (col >= player.buildingWidth || index >= player.buildingSlots) {
            await interaction.reply({ content: 'Coordinates are out of bound', ephemeral: true });
            return;
        }

        const buildOption = interaction.options.getString('type');
        const category = buildings.find(build => (build.target === buildOption));

        // Build new building if land is empty
        if (player.building[index].name === 'Empty') {
            const buildLevel = category.levels[0];
            if (!checkEnoughMoney(buildLevel.cost, player)) {
                await interaction.reply({ content: `You need $${buildLevel.cost[0]}, ${buildLevel.cost[1]} wood, ${buildLevel.cost[2]} stone and ${buildLevel.cost[3]} metal to build ${category.name}`, ephemeral: true });
                return;
            }

            if (buildOption === 'farmHeight') {
                const farm = player.farm;

                for (let i = player.farmArea; i < player.farmWidth * (player.farmHeight + 1); i++) {
                    farm.push({
                        name: 'Empty',
                        timer: new Date
                    });
                }

                await Player.updateOne({ userId }, {
                    $set: {
                        farm,
                        farmHeight: player.farmHeight + 1
                    }
                });
            }

            player.building[index] = {
                name: category.name,
                level: 1
            };
            player.money -= buildLevel.cost[0],
                player.wood -= buildLevel.cost[1],
                player.stone -= buildLevel.cost[2],
                player.metal -= buildLevel.cost[3]

            // Update Player Production Capacities
            await Player.updateOneProduction(player);

            await player.save();

            await interaction.reply(`Spent $${buildLevel.cost[0]}, ${buildLevel.cost[1]} wood, ${buildLevel.cost[2]} stone and ${buildLevel.cost[3]} metal to build ${category.name}`);
        }
        // Check for match and upgrade existing building
        else {
            if (player.building[index].name != category.name) {
                await interaction.reply({ content: `You cannot build ${category.name} as ${player.building[index].name} is already here`, ephemeral: true });
                return;
            }

            // Update Player Production Capacities
            await Player.updateOneProduction(player);

            await player.save();
        }
    },
};
