// The deck's own words, for a deck opened on its own; a host gives its own instead (options.strings).
const STRINGS = /** @type {Record<string, Record<string, string>>} */ ({
  en: { deck: 'Slides', previous: 'Previous', next: 'Next', present: 'Present full screen', presenter: 'Presenter view', overview: 'All slides', edit: 'Change', scheme: 'Light or dark', export: 'Save as PowerPoint', source: 'The deck as text', notes: 'Notes', noNotes: 'No notes for this slide.', upNext: 'Next', last: 'Last slide', where: 'Slide {n} of {count}', saved: 'Saved' },
  fr: { deck: 'Diapositives', previous: 'Précédente', next: 'Suivante', present: 'Présenter en plein écran', presenter: 'Vue présentateur', overview: 'Toutes les diapositives', edit: 'Modifier', scheme: 'Clair ou sombre', export: 'Enregistrer en PowerPoint', source: 'La présentation en texte', notes: 'Notes', noNotes: 'Pas de notes pour cette diapositive.', upNext: 'Ensuite', last: 'Dernière diapositive', where: 'Diapositive {n} sur {count}', saved: 'Enregistré' },
  ar: { deck: 'الشرائح', previous: 'السابقة', next: 'التالية', present: 'العرض بملء الشاشة', presenter: 'عرض المقدّم', overview: 'كل الشرائح', edit: 'تعديل', scheme: 'فاتح أو داكن', export: 'الحفظ بصيغة PowerPoint', source: 'العرض كنص', notes: 'الملاحظات', noNotes: 'لا ملاحظات لهذه الشريحة.', upNext: 'التالية', last: 'الشريحة الأخيرة', where: 'الشريحة {n} من {count}', saved: 'تم الحفظ' },
  ja: { deck: 'スライド', previous: '前へ', next: '次へ', present: '全画面で発表', presenter: '発表者ビュー', overview: 'すべてのスライド', edit: '編集', scheme: 'ライトまたはダーク', export: 'PowerPoint で保存', source: 'テキストとしてのスライド', notes: 'メモ', noNotes: 'このスライドにメモはありません。', upNext: '次', last: '最後のスライド', where: 'スライド {n} / {count}', saved: '保存しました' },
})

/** @param {string} lang */
export const stringsFor = (lang) => STRINGS[lang.split('-')[0].toLowerCase()] ?? STRINGS.en
