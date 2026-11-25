
import { InlineKeyboard, Keyboard } from "grammy"

const orders = new Map()

export function registerCommands(bot) {
  bot.command("start", (ctx) =>
    ctx.reply(
      "🚕 Taxi Andijon ↔ Samarqand\n\nBuyurtma berish uchun tugmani bosing.",
      {
        reply_markup: new InlineKeyboard()
          .text("🚕 Taxi buyurtma", "new_order"),
      },
    ),
  )

  bot.command("help", (ctx) =>
    ctx.reply(
      "🚕 Taxi bot\n\n/start — Buyurtma berish\n/help — Yordam\n/id — Telegram ID",
    ),
  )

  bot.command("id", (ctx) =>
    ctx.reply(`Sizning Telegram ID: ${ctx.from.id}`),
  )

  bot.command("ping", (ctx) => ctx.reply("pong"))

  bot.callbackQuery("new_order", async (ctx) => {
    orders.set(ctx.from.id, { step: "route" })

    await ctx.answerCallbackQuery()

    await ctx.reply("🛣 Qaysi yo‘nalishga buyurtma berasiz?", {
      reply_markup: new InlineKeyboard()
        .text("Andijon → Samarqand", "route_as")
        .row()
        .text("Samarqand → Andijon", "route_sa"),
    })
  })

  bot.callbackQuery(["route_as", "route_sa"], async (ctx) => {
    const order = orders.get(ctx.from.id)

    if (!order) {
      await ctx.answerCallbackQuery({
        text: "Avval /start orqali buyurtma boshlang.",
      })
      return
    }

    order.route =
      ctx.callbackQuery.data === "route_as"
        ? "Andijon → Samarqand"
        : "Samarqand → Andijon"

    order.step = "contact"

    await ctx.answerCallbackQuery()

    await ctx.reply(
      `Yo‘nalish: ${order.route}\n\nTelefon raqamingizni yuboring:`,
      {
        reply_markup: new Keyboard()
          .requestContact("📱 Telefon raqamni yuborish")
          .resized()
          .oneTime(),
      },
    )
  })

  bot.on("message:contact", async (ctx) => {
    const order = orders.get(ctx.from.id)

    if (!order || order.step !== "contact") {
      return ctx.reply("Buyurtma boshlash uchun /start bosing.")
    }

    const contact = ctx.message.contact

    if (contact.user_id && contact.user_id !== ctx.from.id) {
      return ctx.reply("Iltimos, o‘zingizning telefon raqamingizni yuboring.")
    }

    const driverId = process.env.DRIVER_CHAT_ID

    if (!driverId) {
      return ctx.reply(
        "⚠️ Haydovchi ID sozlanmagan. Buyurtma yuborilmadi.",
        { reply_markup: { remove_keyboard: true } },
      )
    }

    const passengerName =
      [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ")

    const message =
      `🚕 YANGI TAXI BUYURTMASI\n\n` +
      `🛣 Yo‘nalish: ${order.route}\n` +
      `👤 Yo‘lovchi: ${passengerName}\n` +
      `📱 Telefon: ${contact.phone_number}\n` +
      `🆔 Telegram ID: ${ctx.from.id}`

    try {
      await bot.api.sendMessage(driverId, message)

      orders.delete(ctx.from.id)

      await ctx.reply(
        "✅ Buyurtmangiz haydovchiga yuborildi!\nHaydovchi siz bilan bog‘lanadi.",
        { reply_markup: { remove_keyboard: true } },
      )
    } catch (error) {
      console.error("[order] send failed:", error)

      await ctx.reply(
        "❌ Buyurtmani yuborib bo‘lmadi. Haydovchi botni /start qilganini tekshiring.",
        { reply_markup: { remove_keyboard: true } },
      )
    }
  })

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text

    if (text.startsWith("/")) return

    const order = orders.get(ctx.from.id)

    if (order?.step === "contact") {
      return ctx.reply(
        "Telefon raqamini tugma orqali yuboring, iltimos.",
        {
          reply_markup: new Keyboard()
            .requestContact("📱 Telefon raqamni yuborish")
            .resized()
            .oneTime(),
        },
      )
    }

    return ctx.reply("Buyurtma berish uchun /start bosing.")
  })
}
