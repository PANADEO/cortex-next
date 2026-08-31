/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: false,
  devIndicators: false,
  // Server Actions są w tym repo zabronione (docs/modular-monolith.md), a Biurko ich nie używa —
  // wgrywanie idzie przez route handler, więc `bodySizeLimit` i tak nic tu nie robiło.
}
