/** İstemciden Route Handler çağrısı; hata durumunda sunucunun Türkçe mesajını taşıyan Error fırlatır. */
export async function apiRequest(url, { method = 'POST', body, formData } = {}) {
  let response
  try {
    response = await fetch(url, {
      method,
      headers: formData ? undefined : { 'Content-Type': 'application/json' },
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.')
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // JSON olmayan yanıt
  }

  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || 'İşlem tamamlanamadı.')
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}
