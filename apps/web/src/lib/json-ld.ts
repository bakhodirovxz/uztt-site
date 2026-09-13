/**
 * JSON-LD ni `<script>` ichiga xavfsiz joylashtirish.
 *
 * `JSON.stringify` `<` belgisini qochirmaydi, shuning uchun sarlavhasida
 * `</script><script>...` bo'lgan yozuv script elementidan chiqib ketadi.
 * Bu nazariy xavf emas: sayt kontentining bir qismi uttf.uz'dan ommaviy
 * import qilingan va inson ko'rigidan o'tmagan.
 *
 * U+2028/U+2029 ham qochiriladi — ular JSON'da haqiqiy belgi, JS satrida
 * esa qator uzilishi hisoblanadi va skriptni sintaktik buzadi.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
