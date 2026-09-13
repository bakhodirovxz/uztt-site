/**
 * Federatsiya aloqa ma'lumotlari — bitta manba.
 *
 * Ilgari bular ikki joyda qattiq yozilgan va BIR-BIRIGA ZID edi:
 * header'da `info@uttf.uz` (eski federatsiya sayti), footer'da
 * `info@uztt.uz`. Jonli saytda ikkala manzil ham ko'rinib turardi.
 */
export const SITE_CONTACT = {
  phone: '+998 (99) 115-30-30',
  phoneHref: 'tel:+998991153030',
  email: 'info@uztt.uz',
  emailHref: 'mailto:info@uztt.uz',
  city: "Toshkent, O'zbekiston",
} as const;
