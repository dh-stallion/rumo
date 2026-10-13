import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// O logo já é de borda a borda; o iOS arredonda os cantos sozinho.
const semMargem = { padding: 0, resizeOptions: { background: '#4f46e5' } };

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...semMargem },
    apple: { ...minimal2023Preset.apple, ...semMargem },
  },
  images: ['public/logo.svg'],
});
