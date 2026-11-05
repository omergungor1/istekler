import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMaskedRequestInput, maskText } from '@/lib/privacy/mask'

test('TC kimlik, telefon, e-posta ve hasta numarası maskelenir', () => {
  const { text, counts } = maskText('TC: 10000000146, tel 0555 000 00 00, mail deneme@example.com, hasta no: 123456789')
  assert.ok(!text.includes('10000000146'))
  assert.ok(!text.includes('0555 000 00 00'))
  assert.ok(!text.includes('deneme@example.com'))
  assert.ok(!text.includes('123456789'))
  assert.equal(counts.TC_KIMLIK, 1)
  assert.equal(counts['E-POSTA'], 1)
  assert.ok(text.includes('[TELEFON]'))
})

test('isimli hasta kalıbı ve unvanlı personel adı maskelenir', () => {
  const { text } = maskText('Deneme Örnekoğlu isimli hastanın kaydı. Dr. Kurgu Hekim bilgilendirildi.')
  assert.ok(!text.includes('Deneme Örnekoğlu'))
  assert.ok(!text.includes('Kurgu Hekim'))
  assert.ok(text.includes('[HASTA]'))
  assert.ok(text.includes('[PERSONEL]'))
})

test('"Hasta Kabul" gibi modül adları isim sanılmaz', () => {
  const { text, risks } = maskText('Hasta Kabul ekranında Hasta Listesi raporu açılmıyor. Hastane genelinde sorun var.')
  assert.equal(text, 'Hasta Kabul ekranında Hasta Listesi raporu açılmıyor. Hastane genelinde sorun var.')
  assert.equal(risks.length, 0)
})

test('maskelenemeyen olası isim risk olarak işaretlenir', () => {
  const { risks } = maskText('Hastanın Ayşe Kurgu kaydı açılmıyor.')
  assert.ok(risks.length > 0)
})

test('HTML entity metinleri düz metne çevrilir', () => {
  assert.equal(maskText('&quot;Onaylı&quot; &lt;br&gt;').text, '"Onaylı" <br>')
})

test('kişi alanları AI girdisine hiç eklenmez', () => {
  const input = buildMaskedRequestInput({
    external_no: '1',
    subject: 'Konu',
    description: 'Açıklama',
    content_hash: 'h',
    requested_by: 'GİZLİ KULLANICI',
    tracked_by: 'GİZLİ TAKİP',
    replied_by: 'GİZLİ CEVAP',
  })
  assert.ok(!JSON.stringify(input).includes('GİZLİ'))
})

test('maskeleme düzeltmesi yalnızca içerik değişmediyse kullanılır', () => {
  const base = { external_no: '1', subject: 'K', description: 'orijinal', ai_input_override: 'düzeltilmiş', ai_input_override_hash: 'h1' }
  assert.equal(buildMaskedRequestInput({ ...base, content_hash: 'h1' }).description, 'düzeltilmiş')
  assert.equal(buildMaskedRequestInput({ ...base, content_hash: 'h2' }).description, 'orijinal')
})
