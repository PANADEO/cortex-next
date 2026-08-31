/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: false,
  devIndicators: false,
  // Rdzeń Biurka jest pakietem workspace w TypeScripcie i sięgają po niego także
  // komponenty klienckie — bez tego Next nie przepuści go przez swój transpiler.
  transpilePackages: ['@cortex/desk-core', '@cortex/desk-ui'],
  // Server Actions są w tym repo zabronione (docs/modular-monolith.md), a Biurko ich nie używa —
  // wgrywanie idzie przez route handler, więc `bodySizeLimit` i tak nic tu nie robiło.
}
