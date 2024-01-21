import vine from '@vinejs/vine'

export const searchBipsValidator = vine.compile(
  vine.object({
    q: vine.string().trim().escape().minLength(3),
  })
)
