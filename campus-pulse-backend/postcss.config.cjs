// Empty PostCSS config for the backend package — prevents Vite from walking
// up to the parent repo's postcss.config.mjs (which requires tailwindcss).
module.exports = { plugins: [] };
