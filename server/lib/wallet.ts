// server/lib/wallet.ts
export function pointerToUrl(pointer: string): string {
  const p = pointer.trim();
  // Payment Pointer → https://host/.well-known/pay[...]
  if (p.startsWith('$')) {
    const without = p.slice(1);
    const clean = without.startsWith('/') ? without.slice(1) : without;
    // Si el pointer ya trae ruta (/alice), el .well-known/pay se resuelve en ese host.
    return `https://${clean}/.well-known/pay`;
  }
  // Si ya es una URL http(s), devuélvela como está (muchas wallets de Rafiki hablan JSON directo)
  return p;
}

export async function resolveWallet(pointer: string) {
  const url = pointerToUrl(pointer);

  // Intento 1: Open Payments JSON
  let res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    // Intento 2: SPSP (Payment Pointer clásico)
    res = await fetch(url, { headers: { Accept: 'application/spsp4+json, application/json' } });
  }
  if (!res.ok) throw new Error(`No se pudo resolver la wallet (${res.status})`);

  const info = await res.json().catch(() => ({}));
  // Campos típicos a exponer
  const assetCode = info.assetCode ?? info.asset?.code ?? null;
  const assetScale = info.assetScale ?? info.asset?.scale ?? null;

  return { resolvedUrl: url, info, assetCode, assetScale };
}
//server\lib\wallet.ts