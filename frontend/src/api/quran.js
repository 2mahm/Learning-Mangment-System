const BASE = 'https://api.alquran.cloud/v1'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.code !== 200) throw new Error(json.status || 'API error')
  return json.data
}

export const getSurahs = () => get('/surah')

export const getSurahEditions = (number, editions) =>
  get(`/surah/${number}/editions/${editions.join(',')}`)

export const getSurah = (number, edition = 'ar.uthmani') =>
  get(`/surah/${number}/${edition}`)

export const searchQuran = keyword =>
  get(`/search/${encodeURIComponent(keyword)}/all/ar`)

export const audioUrl = globalNum =>
  `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalNum}.mp3`

export function mergeEditions(editionsData) {
  const map = {}
  for (const ed of editionsData) {
    map[ed.edition.identifier] = ed.ayahs
  }
  const base = map['ar.uthmani'] || map[Object.keys(map)[0]] || []
  return base.map((a, i) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    arabic: a.text,
    english: (map['en.sahih']  || [])[i]?.text || '',
    tafsir:  (map['ar.muyassar'] || [])[i]?.text || '',
  }))
}
