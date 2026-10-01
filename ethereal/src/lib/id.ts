/** Short, collision-resistant ids: time-ordered prefix + random suffix. */
export function uid(): string {
  const time = Date.now().toString(36)
  let rand = ''
  for (let i = 0; i < 8; i++) rand += Math.floor(Math.random() * 36).toString(36)
  return `${time}${rand}`
}
