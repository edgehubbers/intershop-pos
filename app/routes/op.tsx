// app/routes/op.tsx
import type { Route } from "./+types/op";
import { useLoaderData } from "react-router";

/** Lee la clave privada de variables de entorno (PEM o Base64). */
function readPrivateKeyPEM(): string | null {
  const rawPem = process.env.OPEN_PAYMENTS_PRIVATE_KEY_PEM;
  if (rawPem && rawPem.length > 0) return rawPem.replace(/\\n/g, "\n");

  const b64 = process.env.OPEN_PAYMENTS_PRIVATE_KEY_B64;
  if (b64 && b64.length > 0) {
    const pem = Buffer.from(b64, "base64").toString("utf8");
    if (pem.includes("BEGIN")) return pem;
    const body = pem.match(/.{1,64}/g)?.join("\n") ?? pem;
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  }
  return null;
}

export async function loader({}: Route.LoaderArgs) {
  const pem = readPrivateKeyPEM();
  if (!pem) return { hasKey: false as const };

  // Importar node:crypto sólo en servidor
  const { createPrivateKey, createPublicKey, sign, verify, createHash } = await import("node:crypto");

  // Construir llaves y firmar/validar un mensaje corto (Ed25519)
  const privateKey = createPrivateKey({ key: pem, format: "pem" });
  const publicKey = createPublicKey(privateKey);

  const data = Buffer.from("open-payments-self-test");
  const sig = sign(null, data, privateKey); // Ed25519
  const ok = verify(null, data, publicKey, sig);

  // Huella pública útil (SPKI DER -> SHA-256)
  const pubDer: any = publicKey.export({ format: "der", type: "spki" });
  const fingerprint = createHash("sha256").update(pubDer).digest("base64url");

  return {
    hasKey: true as const,
    ok,
    fingerprint,
    signatureB64: sig.toString("base64url"),
  };
}

export default function OpenPaymentsSandbox() {
  const data = useLoaderData<typeof loader>();

  if (!data.hasKey) {
    return (
      <section className="rounded-2xl border p-6 space-y-3">
        <h1 className="text-xl font-semibold">Open Payments — pruebas</h1>
        <p className="opacity-80">
          Falta configurar la clave privada en <code>.env</code>. Agrega una de estas variables:
        </p>
        <pre className="p-3 rounded bg-gray-950/5 overflow-auto text-sm">
{`# .env (NO subir a git)
OPEN_PAYMENTS_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----
...tu clave en formato PEM...
-----END PRIVATE KEY-----"
# o, si la tienes en base64:
OPEN_PAYMENTS_PRIVATE_KEY_B64=...base64_del_PEM...
`}
        </pre>
        <p className="opacity-80">Luego reinicia el servidor de desarrollo.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border p-6 space-y-3">
      <h1 className="text-xl font-semibold">Open Payments — pruebas</h1>
      <p className="opacity-80">
        Clave cargada en el servidor. Firma de prueba:{" "}
        <span className={data.ok ? "text-green-600" : "text-red-600"}>
          {data.ok ? "válida ✅" : "inválida ❌"}
        </span>
      </p>
      <div className="text-sm space-y-1">
        <div>
          <span className="opacity-70">Fingerprint pública (SPKI/SHA-256): </span>
          <code className="break-all">{data.fingerprint}</code>
        </div>
        <div>
          <span className="opacity-70">Firma (base64url): </span>
          <code className="break-all">{data.signatureB64}</code>
        </div>
      </div>

      <p className="opacity-70 text-sm">
        Próximo paso: firmar requests HTTP (HTTP Message Signatures) y llamar endpoints reales
        de Open Payments usando este loader como proxy seguro.
      </p>
    </section>
  );
}
