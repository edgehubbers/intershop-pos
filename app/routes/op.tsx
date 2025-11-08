import type { Route } from "./+types/op";
import { useLoaderData } from "react-router";

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

  const { createPrivateKey, createPublicKey, sign, verify, createHash } = await import("node:crypto");

  const privateKey = createPrivateKey({ key: pem, format: "pem" });
  const publicKey = createPublicKey(privateKey);

  const data = Buffer.from("open-payments-self-test");
  const sig = sign(null, data, privateKey); // Ed25519
  const ok = verify(null, data, publicKey, sig);

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
          Falta configurar la clave privada en <code>.env</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border p-6 space-y-3">
      <h1 className="text-xl font-semibold">Open Payments — pruebas</h1>
      <p className="opacity-80">
        Firma de prueba:{" "}
        <span className={data.ok ? "text-green-600" : "text-red-600"}>
          {data.ok ? "válida ✅" : "inválida ❌"}
        </span>
      </p>
      <div className="text-sm space-y-1">
        <div>
          <span className="opacity-70">Fingerprint pública: </span>
          <code className="break-all">{data.fingerprint}</code>
        </div>
        <div>
          <span className="opacity-70">Firma (base64url): </span>
          <code className="break-all">{data.signatureB64}</code>
        </div>
      </div>
    </section>
  );
}
//app\routes\op.tsx