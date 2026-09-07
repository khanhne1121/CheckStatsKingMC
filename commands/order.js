/**
 * commands/order.js - Slash Command /order <item>
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { getCustomEmoji } = require('../helpers/utils');
const { recordError } = require('../helpers/reportHelper');
const configHelper = require('../helpers/configHelper');
const { renderTableImage, formatItemDisplayName } = require('../helpers/renderHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order')
    .setDescription('Kiểm tra danh sách đơn hàng (order) của một item trên KingMC')
    .addStringOption(option => 
      option.setName('item')
        .setDescription('Tên item cần kiểm tra (ví dụ: elytra)')
        .setRequired(true)
    ),

  async execute(interaction, queueDispatcher) {
    const itemQuery = interaction.options.getString('item').trim();
    const BOT_CHECK_TIMEOUT = parseInt(process.env.BOT_CHECK_TIMEOUT) || 15000;

    await interaction.deferReply();

    try {
      // Gửi tác vụ vào Queue Dispatcher
      const result = await queueDispatcher.enqueueTask('order', itemQuery, BOT_CHECK_TIMEOUT);

      const orders = result.orders || [];
      const itemDisplayName = formatItemDisplayName(itemQuery);

      // Trường hợp KHÔNG có đơn hàng nào
      if (orders.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle(`📦 Đơn hàng: **${itemDisplayName}**`)
          .setDescription(`⚠️ Không có order (đơn hàng) nào cho **${itemDisplayName}**.`)
          .setColor('#ef4444')
          .setTimestamp()
          .setFooter({ text: 'KingMC.vn Stats Bot • By Kian Nguyen' });

        return await interaction.editReply({ embeds: [emptyEmbed] });
      }

      // Lấy chế độ hiển thị từ configHelper ('text' hoặc 'image')
      const displayMode = configHelper.getDisplayMode();
      const emoji = getCustomEmoji(itemQuery);

      // CHẾ ĐỘ RENDER ẢNH (Image Mode) - Giống như trong ảnh
      if (displayMode === 'image') {
        let imageBuffer = null;
        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            imageBuffer = await renderTableImage(
              `DANH SÁCH ORDER: ${itemQuery.toUpperCase()}`,
              itemQuery,
              orders,
              'order'
            );
            if (imageBuffer) break;
          } catch (renderErr) {
            lastError = renderErr;
            console.error(`[Discord-Bot] Lần thử ${attempt} render ảnh Order lỗi:`, renderErr.message);
          }
        }

        if (imageBuffer) {
          const attachment = new AttachmentBuilder(imageBuffer, { name: 'order_table.png' });

          const embed = new EmbedBuilder()
            .setImage('attachment://order_table.png')
            .setColor('#2b2d31')
            .setTimestamp()
            .setFooter({ text: 'KingMC.vn Stats Bot • Thiết kế bởi BinhLH' });

          return await interaction.editReply({ embeds: [embed], files: [attachment] });
        }
        console.error('[Discord-Bot] Render ảnh Order thất bại sau 2 lần thử:', lastError?.message);
      }

      // CHẾ ĐỘ VĂN BẢN (Text Mode) - Định dạng như bảng đơn giản
      // Tạo tiêu đề bảng
      let tableHeader = '```\n';
      tableHeader += `📋 DANH SÁCH ORDER: ${itemQuery.toUpperCase()}\n`;
      tableHeader += `${'─'.repeat(50)}\n`;
      tableHeader += `#  ITEM                    GIÁ\n`;
      tableHeader += `${'─'.repeat(50)}\n`;
      
      // Tạo nội dung bảng
      let tableContent = '';
      orders.forEach((order, index) => {
        const priceText = order.price || 'N/A';
        const cleanDisplay = (order.displayName || '').replace(/§[0-9a-fk-or]/gi, '').trim();
        const rawName = order.itemName || order.name;
        
        // Xác định tên item hiển thị
        let itemName = '';
        if (cleanDisplay && !/^(?:đơn\s*hàng|don\s*hang|order)/iu.test(cleanDisplay) && cleanDisplay !== 'Item' && cleanDisplay !== 'Vật phẩm') {
          itemName = cleanDisplay;
        } else if (rawName && rawName !== 'player_head' && rawName !== 'skull' && rawName !== 'air') {
          itemName = rawName;
        } else {
          itemName = itemQuery;
        }
        
        // Cắt tên item nếu quá dài để hiển thị đẹp
        if (itemName.length > 22) {
          itemName = itemName.substring(0, 20) + '..';
        }
        
        // Định dạng số (thêm dấu chấm phân cách)
        const formattedPrice = priceText.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        
        // Thêm dòng vào bảng
        const itemStr = `#${String(index + 1).padStart(2)}  ${itemName.padEnd(22)} ${formattedPrice.padStart(15)}`;
        tableContent += itemStr + '\n';
      });
      
      // Đóng bảng
      const tableFooter = `${'─'.repeat(50)}\n`;
      const tableEnd = '```';
      
      // Kết hợp tất cả
      let fullTable = tableHeader + tableContent + tableFooter + tableEnd;
      
      // Kiểm tra giới hạn ký tự của Discord (2000 ký tự)
      if (fullTable.length > 2000) {
        // Nếu quá dài, chỉ hiển thị 15 order đầu
        const limitedOrders = orders.slice(0, 15);
        let limitedContent = '';
        limitedOrders.forEach((order, index) => {
          const priceText = order.price || 'N/A';
          const cleanDisplay = (order.displayName || '').replace(/§[0-9a-fk-or]/gi, '').trim();
          const rawName = order.itemName || order.name;
          
          let itemName = '';
          if (cleanDisplay && !/^(?:đơn\s*hàng|don\s*hang|order)/iu.test(cleanDisplay) && cleanDisplay !== 'Item' && cleanDisplay !== 'Vật phẩm') {
            itemName = cleanDisplay;
          } else if (rawName && rawName !== 'player_head' && rawName !== 'skull' && rawName !== 'air') {
            itemName = rawName;
          } else {
            itemName = itemQuery;
          }
          
          if (itemName.length > 22) {
            itemName = itemName.substring(0, 20) + '..';
          }
          
          const formattedPrice = priceText.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          const itemStr = `#${String(index + 1).padStart(2)}  ${itemName.padEnd(22)} ${formattedPrice.padStart(15)}`;
          limitedContent += itemStr + '\n';
        });
        
        fullTable = tableHeader + limitedContent + `\n... và ${orders.length - 15} order khác\n` + tableFooter + tableEnd;
      }

      // Tạo embed với bảng đã định dạng
      const embed = new EmbedBuilder()
        .setDescription(fullTable)
        .setColor('#2b2d31')
        .setTimestamp()
        .setFooter({ text: `KingMC.vn Stats Bot • Thiết kế bởi BinhLH • Tổng: ${orders.length} order` });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error(`[Discord-Bot] Lỗi khi xử lý lệnh order cho ${itemQuery}:`, error.message);
      recordError('order', itemQuery, error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Lỗi kiểm tra đơn hàng')
        .setDescription(`Không thể lấy danh sách đơn hàng cho **${itemQuery}**.\n\n⚠️ Đã có lỗi xảy ra trong quá trình xử lý yêu cầu. Vui lòng thử lại sau hoặc bấm nút **Báo lỗi** bên dưới để gửi thông báo tới Admin!`)
        .setColor('#ef4444')
        .setTimestamp()
        .setFooter({ text: 'KingMC.vn Stats Bot • Kian Nguyen' });
        
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`report_error_order_${itemQuery}`)
            .setLabel('Báo lỗi')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({ embeds: [errorEmbed], components: [row] });
    }
  }
};
