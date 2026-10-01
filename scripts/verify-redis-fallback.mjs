import assert from "node:assert/strict"
import { createRequire } from "node:module"
import net from "node:net"
import fs from "node:fs"
import ts from "typescript"

const probe = net.createServer()
await new Promise((resolve, reject) => {
  probe.once("error", reject)
  probe.listen(0, "127.0.0.1", resolve)
})
const port = probe.address().port
await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()))

process.env.REDIS_URL = `redis://127.0.0.1:${port}`

const source = fs.readFileSync("lib/redis.ts", "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText
const redisModule = { exports: {} }
const requireFromScript = createRequire(import.meta.url)
new Function("require", "module", "exports", compiled)(
  requireFromScript,
  redisModule,
  redisModule.exports,
)

const startedAt = Date.now()
assert.equal(await redisModule.exports.getRedis(), null)
const firstAttemptMs = Date.now() - startedAt
assert.ok(firstAttemptMs < 5000, `initial fallback took ${firstAttemptMs} ms`)

const retryStartedAt = Date.now()
assert.equal(await redisModule.exports.getRedis(), null)
const cooldownMs = Date.now() - retryStartedAt
assert.ok(cooldownMs < 100, `cooldown fallback took ${cooldownMs} ms`)

console.log(
  `Redis fallback verification passed: first failure ${firstAttemptMs} ms; cooldown ${cooldownMs} ms.`,
)
