import type { Subcommand } from '../../util/commands';
import { EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';

// Utils
import { lock, writePortsFile } from '../../modules/slack';
import { execAsync } from '../../util/exec';
import { updateInfoForTeam } from '../../bot';
import { autocompleteTargets } from '../../util/autocomplete';


export default {
    data: new SlashCommandSubcommandBuilder()
        .setName('update')
        .setDescription('Update the IP and port for the specified target.')
        .addStringOption((option) => option
            .setName('target')
            .setDescription('The target to update.')
            .setAutocomplete(true)
            .setRequired(true))
        .addStringOption((option) => option
            .setName('ip')
            .setDescription('The new IP.')
            .setRequired(true))
        .addIntegerOption((option) => option
            .setName('port_low')
            .setDescription('The new low port.')
            .setRequired(true))
        .addIntegerOption((option) => option
            .setName('port_high')
            .setDescription('The new high port.')
            .setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getString('target', true);
        const ip = interaction.options.getString('ip', true);
        const portLow = interaction.options.getInteger('port_low', true);
        const portHigh = interaction.options.getInteger('port_high', true);

        await updateInfoForTeam(target, ip, portLow, portHigh);

        await writePortsFile(target, ip, portLow, portHigh);
        await lock.acquire('git', async () => {
            await execAsync(`cd temp && git pull --ff-only && git add "${target}/" && git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Update ports for ${target}" && git push`);
        });

        const successEmbed = new EmbedBuilder()
            .setDescription('Successfully updated target info.')
            .setColor('#C61130')
        await interaction.reply({ embeds: [successEmbed] });
    },
    autocomplete: autocompleteTargets
} satisfies Subcommand;
