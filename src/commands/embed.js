import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { isValidUrl, resolveColor } from '../utils/validate.js';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Send a formatted embed message')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option.setName('title').setDescription('Title of the embed').setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('description').setDescription('Description text of the embed').setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('color').setDescription('Hex color (e.g. #006400)').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('image').setDescription('Image URL').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('thumbnail').setDescription('Thumbnail image URL').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('footer').setDescription('Footer text').setRequired(false)
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
      ephemeral: true,
    });
  }

  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const colorInput = interaction.options.getString('color');
  const imageInput = interaction.options.getString('image');
  const thumbnailInput = interaction.options.getString('thumbnail');
  const footerInput = interaction.options.getString('footer');

  if (colorInput) {
    const colorResult = resolveColor(colorInput);
    if (colorResult === undefined) {
      return interaction.reply({
        content: `Invalid color \`${colorInput}\`. Please use a hex color like \`#006400\` or a valid integer.`,
        ephemeral: true,
      });
    }
  }

  if (imageInput && !isValidUrl(imageInput)) {
    return interaction.reply({
      content: `Invalid image URL: \`${imageInput}\`. Please provide a valid http(s) URL.`,
      ephemeral: true,
    });
  }

  if (thumbnailInput && !isValidUrl(thumbnailInput)) {
    return interaction.reply({
      content: `Invalid thumbnail URL: \`${thumbnailInput}\`. Please provide a valid http(s) URL.`,
        ephemeral: true,
    });
  }

  const embed = new EmbedBuilder().setTitle(title).setDescription(description);

  if (colorInput) {
    const colorResult = resolveColor(colorInput);
    if (colorResult !== null) {
      embed.setColor(colorResult);
    }
  }

  if (imageInput) {
    embed.setImage(imageInput);
  }

  if (thumbnailInput) {
    embed.setThumbnail(thumbnailInput);
  }

  if (footerInput) {
    embed.setFooter({ text: footerInput });
  }

  try {
    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: 'Embed sent.', ephemeral: true });
  } catch (error) {
    console.error('Embed command error:', error);
    return interaction.reply({
      content: 'An error occurred while sending the embed. Please try again.',
      ephemeral: true,
    });
  }
}
