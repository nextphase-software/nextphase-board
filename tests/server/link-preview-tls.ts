// SPDX-License-Identifier: Apache-2.0
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fixtureNames } from "./link-preview-fixtures.ts";

const run = promisify(execFile);
const asnTime = (time: number) => new Date(time).toISOString().slice(0, 19).replace(/\D/g, "") + "Z";

export async function makeLinkPreviewTls() {
  const dir = await mkdtemp(join(tmpdir(), "link-preview-tls-"));
  const now = Date.now();
  const dates = ["-startdate", asnTime(now - 3_600_000), "-enddate", asnTime(now + 7 * 86_400_000)];

  async function issue(name: string, names: readonly string[]) {
    const cwd = join(dir, name);
    await mkdir(cwd);
    const openssl = async (...args: string[]) => {
      try { await run("openssl", args, { cwd, encoding: "utf8" }); }
      catch (error) {
        const stderr = (error as { stderr?: string }).stderr?.trim();
        throw new Error("link preview TLS fixtures need openssl on PATH" + (stderr ? "\n" + stderr : ""), { cause: error });
      }
    };
    await Promise.all([
      writeFile(join(cwd, "index"), ""),
      writeFile(join(cwd, "serial"), "01\n"),
      writeFile(join(cwd, "openssl.cnf"), `[req]
distinguished_name = request_name
[request_name]
commonName = Fixture name
[ca]
default_ca = local
[local]
database = index
new_certs_dir = .
serial = serial
private_key = ca-key.pem
certificate = ca.pem
default_md = sha256
policy = names
[names]
commonName = supplied
[authority]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
[leaf]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = ${names.map(host => `DNS:${host}`).join(",")}
`),
    ]);
    await openssl("req", "-new", "-config", "openssl.cnf", "-subj", `/CN=Board link preview ${name} fixture CA`,
      "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-keyout", "ca-key.pem", "-out", "ca.csr");
    await openssl("ca", "-config", "openssl.cnf", "-batch", "-selfsign", "-extensions", "authority", ...dates,
      "-in", "ca.csr", "-out", "ca.pem", "-notext");
    await openssl("req", "-new", "-config", "openssl.cnf", "-subj", `/CN=${names[0]}`,
      "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-keyout", "leaf-key.pem", "-out", "leaf.csr");
    await openssl("ca", "-config", "openssl.cnf", "-batch", "-extensions", "leaf", ...dates,
      "-in", "leaf.csr", "-out", "leaf.pem", "-notext");
    return Promise.all(["ca.pem", "leaf.pem", "leaf-key.pem"].map(file => readFile(join(cwd, file), "utf8")));
  }

  try {
    const [ca, pageCert, pageKey] = await issue("trusted", fixtureNames);
    const [wrongCa, wrongCert, wrongKey] = await issue("untrusted", ["wrongca.test"]);
    return { dir, ca, pageCert, pageKey, wrongCa, wrongCert, wrongKey };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}
