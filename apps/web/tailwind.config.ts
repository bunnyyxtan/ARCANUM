import arcanumTailwindPreset from "../../packages/config/tailwind.preset";

const tailwindConfig = {
  presets: [arcanumTailwindPreset],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
};

export default tailwindConfig;
